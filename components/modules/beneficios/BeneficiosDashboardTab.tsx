"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buscarSemCache, useAtualizacaoAoVoltar } from "@/lib/useAtualizacaoAoVoltar";
import { Card, StatCard } from "@/components/shared/Card";
import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/format";

interface LinhaRateio {
  colaboradorId: number;
  nome: string;
  vinculo: string | null;
  departamento: string | null;
  rateioD365: string | null;
  tipoTransporte: string;
  valeTransporte: number;
  valeAlimentacao: number;
  odontologico: number | null;
  /** Aniversário e demais lançamentos variáveis do mês. */
  variaveis: number;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  outrosCustos: number | null;
}

interface ResumoMensal {
  mes: number;
  /** Vale transporte — por dia útil. */
  vt: number;
  /** Vale mobilidade — valor fixo do mês. */
  vm: number;
  /** Vale refeição. */
  vr: number;
  odontoPlataformas: number;
  brindes: number;
  variaveis: number;
  total: number;
  /** Total informado pelo DP, para conferir contra a fatura; não substitui o rateio. */
  informadoVt: number | null;
  informadoVm: number | null;
  informadoVr: number | null;
  informado: boolean;
  /** Mês fechado no Breakdown — não aceita mais edição em lugar nenhum do portal. */
  fechado: boolean;
}

const ANO_ATUAL = new Date().getFullYear();
const ANOS_DISPONIVEIS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_COMPLETOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaExibida(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_COMPLETOS[mes - 1].charAt(0).toUpperCase()}${MESES_COMPLETOS[mes - 1].slice(1)}/${ano}`;
}

/**
 * Sufixo com o total informado pelo DP e a diferença contra o rateio.
 *
 * O cartão mostra o RATEIO, que é a soma que a aba ao lado detalha. O informado
 * vem ao lado, para conferência — antes ele substituía o rateio, e mexer no
 * cadastro de alguém não mudava o número do topo.
 */
function diferenca(calculado: number, informado: number | null | undefined): string {
  if (informado === null || informado === undefined) return "";
  const delta = calculado - informado;
  if (Math.abs(delta) < 0.01) return ` · informado ${formatarMoeda(informado)} (igual)`;
  const sinal = delta > 0 ? "+" : "−";
  return ` · informado ${formatarMoeda(informado)} (${sinal}${formatarMoeda(Math.abs(delta))})`;
}

function formatarK(valor: number): string {
  return valor >= 1000 ? `${(valor / 1000).toFixed(1)}k` : formatarMoeda(valor);
}

function totalOdontoPlataformas(l: LinhaRateio): number {
  return (l.odontologico ?? 0) + (l.solides ?? 0) + (l.flash ?? 0);
}

function totalBrindes(l: LinhaRateio): number {
  return (l.bonificacao ?? 0) + (l.outrosCustos ?? 0);
}

type MacroSetor = "Produção" | "Administrativo";

/**
 * Agrupamento em 2 macro-categorias (visão executiva do Dashboard) — setores
 * de chão de fábrica/operação caem em "Produção", áreas de escritório/apoio
 * em "Administrativo". Mapeamento nosso, não vem do cadastro; o Rateio (aba
 * ao lado) continua mostrando o departamento real de cada colaborador.
 */
const MACRO_SETOR: Record<string, MacroSetor> = {
  Produção: "Produção",
  Manutenção: "Produção",
  Engenharia: "Produção",
  "Controle da Qualidade": "Produção",
  "Garantia da Qualidade": "Produção",
  Logística: "Produção",
  Industrial: "Produção",
  Administrativo: "Administrativo",
  "Recursos Humanos": "Administrativo",
  Financeiro: "Administrativo",
  Contábil: "Administrativo",
  Comercial: "Administrativo",
  Diretoria: "Administrativo",
  Planejamento: "Administrativo",
  "Operações de Vendas": "Administrativo",
  "Tecnologia da Informacao": "Administrativo",
};

/**
 * Onde o custo do colaborador é rateado.
 *
 * O centro informado no D365 manda: é classificação contábil, feita por quem
 * responde por ela. O mapa por departamento é só o palpite de quando o campo
 * está vazio — e "Administrativo" como último caso significa "não sabemos",
 * que foi como a Ourivania, sem setor nenhum, virou administrativa em silêncio.
 */
function macroSetor(departamento: string | null, rateioD365?: string | null): MacroSetor {
  if (rateioD365 === "PRO") return "Produção";
  if (rateioD365 === "ADM") return "Administrativo";
  return (departamento && MACRO_SETOR[departamento]) || "Administrativo";
}

interface MesDiasUteis {
  mes: number;
  diasUteis: number;
  origem: "ajustado" | "herdado" | "padrao";
}

export function BeneficiosDashboardTab() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linhas, setLinhas] = useState<LinhaRateio[]>([]);
  const [resumoAnual, setResumoAnual] = useState<ResumoMensal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [diasUteisAno, setDiasUteisAno] = useState(ANO_ATUAL);
  const [meses, setMeses] = useState<MesDiasUteis[]>([]);
  const [editando, setEditando] = useState<number | null>(null);
  const [valorEdicao, setValorEdicao] = useState("");
  const [detalheSetorAberto, setDetalheSetorAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [diasUteisAberto, setDiasUteisAberto] = useState(false);

  const ano = Number(competencia.slice(0, 4));

  // useCallback porque o hook de atualização depende dela: sem isso a função
  // muda a cada render e o listener seria re-registrado sem parar.
  const recarregar = useCallback(async function recarregar() {
    try {
      const [rateioRes, resumoRes] = await Promise.all([
        buscarSemCache(`/api/beneficios/rateio?competencia=${competencia}`),
        buscarSemCache(`/api/beneficios/resumo-anual?ano=${ano}`),
      ]);
      const [rateioData, resumoData] = await Promise.all([rateioRes.json(), resumoRes.json()]);
      setLinhas(rateioData.linhas ?? []);
      setResumoAnual(resumoData.meses ?? []);
    } finally {
      setCarregando(false);
    }
  }, [competencia, ano]);

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  // Voltar para o Dashboard depois de mexer no Rateio traz o número novo.
  useAtualizacaoAoVoltar(recarregar);

  async function recarregarDiasUteis() {
    const res = await fetch(`/api/beneficios/dias-uteis?ano=${diasUteisAno}`);
    const data = await res.json();
    setMeses(data.meses ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca de dados ao trocar de ano; setState só ocorre após o await do fetch
    void recarregarDiasUteis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasUteisAno]);

  const mesAtual = Number(competencia.slice(5, 7));

  // Os cartões saem do resumo do mês, que é a soma do rateio — a mesma que a
  // aba ao lado detalha. O total informado pelo DP vem junto, só para apontar
  // a diferença contra a fatura da operadora.
  const resumoDoMes = useMemo(() => resumoAnual.find((m) => m.mes === mesAtual), [resumoAnual, mesAtual]);

  const totalVt = resumoDoMes?.vt ?? 0;
  const totalVm = resumoDoMes?.vm ?? 0;
  const totalVa = resumoDoMes?.vr ?? 0;
  const totalOdonto = resumoDoMes?.odontoPlataformas ?? 0;
  const totalGeral = resumoDoMes?.total ?? 0;

  const elegiveisVt = linhas.filter((l) => l.tipoTransporte !== "vm_fixo" && l.valeTransporte > 0).length;
  const elegiveisVm = linhas.filter((l) => l.tipoTransporte === "vm_fixo" && l.valeTransporte > 0).length;
  const elegiveisVa = linhas.filter((l) => l.valeAlimentacao > 0).length;
  const elegiveisOdonto = linhas.filter((l) => totalOdontoPlataformas(l) > 0).length;

  // O rateio já exclui PJ e quem não está na folha do mês, então quem sobrou
  // recebe benefício — contar só vinculo === "CLT" deixava de fora jovem
  // aprendiz, estagiário e as grafias do cadastro ("CLT - bio"), dizendo 47
  // onde havia 57 pessoas na conta.
  const colaboradoresNaFolha = linhas.length;

  const composicaoPorSetor = useMemo(() => {
    const vazio = { vt: 0, vm: 0, vr: 0, variaveis: 0, colaboradores: 0 };
    const mapa = new Map<MacroSetor, typeof vazio>([
      ["Produção", { ...vazio }],
      ["Administrativo", { ...vazio }],
    ]);
    for (const l of linhas) {
      const chave = macroSetor(l.departamento, l.rateioD365);
      const atual = mapa.get(chave)!;
      // Transporte e mobilidade são verbas diferentes e cada uma tem a sua
      // linha: somadas, o setor perdia de vista quanto era catraca e quanto
      // era auxílio fixo.
      mapa.set(chave, {
        vt: atual.vt + (l.tipoTransporte === "vm_fixo" ? 0 : l.valeTransporte),
        vm: atual.vm + (l.tipoTransporte === "vm_fixo" ? l.valeTransporte : 0),
        vr: atual.vr + l.valeAlimentacao,
        variaveis: atual.variaveis + l.variaveis + totalBrindes(l),
        colaboradores: atual.colaboradores + 1,
      });
    }
    return Array.from(mapa.entries()).map(([setor, v]) => ({
      setor,
      ...v,
      total: v.vt + v.vm + v.vr + v.variaveis,
    }));
  }, [linhas]);

  // Os dois cartões acima agrupam em Produção/Administrativo, que é mapeamento
  // nosso. Este detalhe usa o departamento REAL do cadastro — inclusive o
  // "(sem setor)", que no agrupamento cai em Administrativo por default e
  // desaparecia da vista.
  const detalhePorSetor = useMemo(() => {
    const vazio = { vt: 0, vm: 0, vr: 0, variaveis: 0, colaboradores: 0 };
    const mapa = new Map<string, typeof vazio>();
    for (const l of linhas) {
      const setor = l.departamento?.trim() || "(sem setor)";
      const atual = mapa.get(setor) ?? { ...vazio };
      mapa.set(setor, {
        vt: atual.vt + (l.tipoTransporte === "vm_fixo" ? 0 : l.valeTransporte),
        vm: atual.vm + (l.tipoTransporte === "vm_fixo" ? l.valeTransporte : 0),
        vr: atual.vr + l.valeAlimentacao,
        variaveis: atual.variaveis + l.variaveis + totalBrindes(l),
        colaboradores: atual.colaboradores + 1,
      });
    }
    return Array.from(mapa.entries())
      .map(([setor, v]) => ({ setor, ...v, total: v.vt + v.vm + v.vr + v.variaveis }))
      .sort((a, z) => z.total - a.total);
  }, [linhas]);

  const maxMensal = Math.max(1, ...resumoAnual.map((m) => m.total));

  function abrirEdicao(m: MesDiasUteis) {
    setEditando(m.mes);
    setValorEdicao(String(m.diasUteis));
  }

  const mesEstaFechado = (mes: number) => resumoAnual.some((m) => m.mes === mes && m.fechado);

  async function salvarEdicao(mes: number) {
    // O servidor recusa de qualquer jeito (409); barrar aqui é só para não
    // deixar a pessoa digitar um número que vai ser jogado fora.
    if (diasUteisAno === ano && mesEstaFechado(mes)) {
      setEditando(null);
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/beneficios/dias-uteis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano: diasUteisAno, mes, diasUteis: Number(valorEdicao) }),
      });
      const data = await res.json();
      if (res.ok) setMeses(data.meses ?? []);
      setEditando(null);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="text-sm text-foreground-muted">Carregando...</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          titulo="Total em benefícios"
          valor={formatarMoeda(totalGeral)}
          subtitulo={`${competenciaExibida(competencia)} · ${colaboradoresNaFolha} colaborador(es) na folha`}
          destaque
        />
        <StatCard
          titulo="Vale-transporte"
          valor={formatarMoeda(totalVt)}
          subtitulo={`${elegiveisVt} elegíveis${diferenca(totalVt, resumoDoMes?.informadoVt)}`}
        />
        <StatCard
          titulo="Vale-mobilidade"
          valor={formatarMoeda(totalVm)}
          subtitulo={`${elegiveisVm} elegíveis${diferenca(totalVm, resumoDoMes?.informadoVm)}`}
        />
        <StatCard
          titulo="Vale-refeição"
          valor={formatarMoeda(totalVa)}
          subtitulo={`${elegiveisVa} elegíveis${diferenca(totalVa, resumoDoMes?.informadoVr)}`}
        />
        <StatCard titulo="Odonto + plataformas" valor={formatarMoeda(totalOdonto)} subtitulo={`${elegiveisOdonto} elegíveis`} />
      </div>

      {resumoDoMes?.fechado && (
        <p className="flex items-center gap-1.5 rounded-md border border-hairline bg-brand-surface/40 px-3 py-2 text-[11px] text-foreground-muted">
          <span aria-hidden>🔒</span>
          {competenciaExibida(competencia)} está fechado no Breakdown de folha. Os números abaixo são o retrato do mês e
          nada aqui pode ser alterado — reabra o mês no Breakdown se precisar corrigir alguma coisa.
        </p>
      )}

      {resumoDoMes?.informado && (
        <p className="text-[10.5px] text-foreground-muted">
          Os valores acima são a soma do rateio por colaborador. Entre parênteses, o total que o DP informou para{" "}
          {competenciaExibida(competencia)}: divergir é esperado (recarga proporcional, catraca não usada, ajuste de
          crédito), e a diferença fica à vista para ser conferida com a fatura da operadora.
        </p>
      )}

      <Card className="p-4">
        <h3 className="text-[13px] font-bold text-foreground">Composição dos benefícios por setor</h3>
        <p className="text-[10.5px] text-foreground-muted">
          rateado por headcount · {composicaoPorSetor.map((s) => `${s.colaboradores} ${s.setor}`).join(" · ")} ·{" "}
          {competenciaExibida(competencia)}
        </p>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {composicaoPorSetor.map((s, i) => (
            <div key={s.setor}>
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", i === 0 ? "bg-brand-primary" : "bg-brand-dark-900")} />
                {s.setor} <span className="font-normal text-foreground-muted">{s.colaboradores} colaboradores</span>
              </p>
              <div className="mt-1.5 space-y-1 text-[11.5px]">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Vale-transporte</span>
                  <span className="text-foreground-muted">{formatarMoeda(s.vt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Vale-mobilidade</span>
                  <span className="text-foreground-muted">{formatarMoeda(s.vm)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-primary-800">Vale-refeição</span>
                  <span className="text-brand-primary-800">{formatarMoeda(s.vr)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Variáveis</span>
                  <span className="text-foreground">{formatarMoeda(s.variaveis)}</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-1 font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-brand-primary-800">{formatarMoeda(s.total)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3">
          {/* Os dois blocos acima são macro-categorias nossas. Quem precisa do
              número do próprio setor abre aqui, sem ocupar a tela de quem não
              precisa. */}
          <button
            type="button"
            onClick={() => setDetalheSetorAberto((v) => !v)}
            aria-expanded={detalheSetorAberto}
            className="text-[11.5px] font-semibold text-brand-primary-800 hover:underline"
          >
            {detalheSetorAberto ? "Ocultar" : "Ver"} valor por setor {detalheSetorAberto ? "▴" : "▾"}
          </button>

          {detalheSetorAberto && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full min-w-[34rem] border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-hairline bg-surface-page text-left text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
                    <th className="px-3 py-1.5">Setor</th>
                    <th className="px-3 py-1.5 text-right">Pessoas</th>
                    <th className="px-3 py-1.5 text-right">Vale-transporte</th>
                    <th className="px-3 py-1.5 text-right">Vale-mobilidade</th>
                    <th className="px-3 py-1.5 text-right">Vale-refeição</th>
                    <th className="px-3 py-1.5 text-right">Variáveis</th>
                    <th className="px-3 py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhePorSetor.map((s) => (
                    <tr key={s.setor} className="border-b border-hairline last:border-0">
                      <td className="px-3 py-1.5 text-foreground uppercase">{s.setor}</td>
                      <td className="px-3 py-1.5 text-right text-foreground-muted">{s.colaboradores}</td>
                      <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(s.vt)}</td>
                      <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(s.vm)}</td>
                      <td className="px-3 py-1.5 text-right text-brand-primary-800">{formatarMoeda(s.vr)}</td>
                      <td className="px-3 py-1.5 text-right text-foreground-muted">{formatarMoeda(s.variaveis)}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-brand-primary-800">{formatarMoeda(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-hairline px-3 py-1.5 text-[10.5px] text-foreground-muted">
                Setor conforme o Quadro de Colaboradores. Quem está sem setor aparece como “(sem setor)” — nos dois
                blocos acima ele entra em Administrativo, que é o default do agrupamento.
              </p>
            </div>
          )}
        </div>


        <div className="mt-5 border-t border-hairline pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-foreground">Custo de benefícios por mês</h3>
            <select
              value={ano}
              onChange={(e) => setCompetencia(`${e.target.value}-${competencia.slice(5, 7)}`)}
              className="rounded-md border border-hairline bg-background px-2 py-1 text-[11px] text-foreground-muted"
            >
              {ANOS_DISPONIVEIS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[10.5px] text-foreground-muted">
            clique em um mês para ver o custo aplicado naquele período · {competenciaExibida(competencia)} selecionado
          </p>
          <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-12">
            {resumoAnual.map((m) => {
              const ativo = m.mes === Number(competencia.slice(5, 7));
              return (
                <button
                  key={m.mes}
                  type="button"
                  onClick={() => setCompetencia(`${ano}-${String(m.mes).padStart(2, "0")}`)}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={cn("w-full rounded-t", ativo ? "bg-brand-primary" : "bg-brand-surface")}
                      style={{ height: `${Math.max(6, (m.total / maxMensal) * 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-[10.5px] font-semibold", ativo ? "text-brand-primary-800" : "text-foreground-muted")}>
                    {MESES[m.mes - 1]}
                  </span>
                  <span className="text-[9.5px] text-foreground-muted">{formatarK(m.total)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div>
        <button
          type="button"
          onClick={() => setDiasUteisAberto((v) => !v)}
          className="text-[11.5px] font-semibold text-brand-primary-800 hover:underline"
        >
          {diasUteisAberto ? "Ocultar" : "Ajustar"} dias úteis por mês (usado no cálculo do vale-transporte) {diasUteisAberto ? "▴" : "▾"}
        </button>

        {diasUteisAberto && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-foreground-muted">
                Clique em um mês para ajustar manualmente (ex.: feriados locais, folgas coletivas).
              </p>
              <select
                value={diasUteisAno}
                onChange={(e) => setDiasUteisAno(Number(e.target.value))}
                className="rounded-md border border-brand-surface bg-background px-3 py-1.5 text-sm text-foreground dark:border-brand-neutral/30"
              >
                {ANOS_DISPONIVEIS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {meses.map((m) => (
                <Card key={m.mes} className={cn("p-3", m.origem !== "padrao" && "border-brand-primary/40")}>
                  {editando === m.mes ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-foreground-muted">{MESES[m.mes - 1]}</span>
                      <input
                        type="number"
                        min={0}
                        max={31}
                        autoFocus
                        value={valorEdicao}
                        onChange={(e) => setValorEdicao(e.target.value)}
                        className="w-full rounded-md border border-brand-primary bg-background px-2 py-1 text-sm text-foreground"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => salvarEdicao(m.mes)}
                          className="flex-1 rounded bg-brand-primary px-2 py-1 text-[11px] font-semibold text-brand-white hover:bg-brand-primary-hover disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditando(null)}
                          className="rounded border border-brand-surface px-2 py-1 text-[11px] text-foreground-muted hover:bg-brand-surface"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => abrirEdicao(m)} className="flex w-full flex-col items-start gap-1 text-left">
                      <span className="text-xs font-semibold text-foreground-muted">{MESES[m.mes - 1]}</span>
                      <span className="text-lg font-semibold text-foreground">{m.diasUteis}</span>
                      <span className="text-[10px] text-foreground-muted">
                        {m.origem === "ajustado" ? "ajustado" : m.origem === "herdado" ? "herdado" : "padrão"}
                      </span>
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
