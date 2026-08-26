"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, StatCard } from "@/components/shared/Card";
import { cn } from "@/lib/cn";
import { formatarMoeda } from "@/lib/format";

interface LinhaRateio {
  colaboradorId: number;
  nome: string;
  vinculo: string | null;
  departamento: string | null;
  tipoTransporte: string;
  valeTransporte: number;
  valeAlimentacao: number;
  odontologico: number | null;
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
  /** Total conferido com a operadora, informado pelo DP — não é a soma do cadastro. */
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

function macroSetor(departamento: string | null): MacroSetor {
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
  const [salvando, setSalvando] = useState(false);
  const [diasUteisAberto, setDiasUteisAberto] = useState(false);

  const ano = Number(competencia.slice(0, 4));

  async function recarregar() {
    try {
      const [rateioRes, resumoRes] = await Promise.all([
        fetch(`/api/beneficios/rateio?competencia=${competencia}`),
        fetch(`/api/beneficios/resumo-anual?ano=${ano}`),
      ]);
      const [rateioData, resumoData] = await Promise.all([rateioRes.json(), resumoRes.json()]);
      setLinhas(rateioData.linhas ?? []);
      setResumoAnual(resumoData.meses ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

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

  // Os cartões saem do resumo do mês, não da soma das linhas: quando o DP
  // informa o total pago no mês, é ele que vale, e o resumo já resolve essa
  // escolha verba a verba. Somar as linhas aqui faria o topo da tela discordar
  // do gráfico logo abaixo.
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

  const colaboradoresClt = linhas.filter((l) => l.vinculo === "CLT").length;

  const composicaoPorSetor = useMemo(() => {
    const mapa = new Map<MacroSetor, { vt: number; va: number; brindes: number; colaboradores: number }>([
      ["Produção", { vt: 0, va: 0, brindes: 0, colaboradores: 0 }],
      ["Administrativo", { vt: 0, va: 0, brindes: 0, colaboradores: 0 }],
    ]);
    for (const l of linhas) {
      const chave = macroSetor(l.departamento);
      const atual = mapa.get(chave)!;
      mapa.set(chave, {
        vt: atual.vt + l.valeTransporte,
        va: atual.va + l.valeAlimentacao,
        brindes: atual.brindes + totalBrindes(l),
        colaboradores: atual.colaboradores + 1,
      });
    }
    return Array.from(mapa.entries()).map(([setor, v]) => ({ setor, ...v, total: v.vt + v.va + v.brindes }));
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
          subtitulo={`${competenciaExibida(competencia)} · ${colaboradoresClt} colaborador(es) CLT`}
          destaque
        />
        <StatCard
          titulo="Vale-transporte"
          valor={formatarMoeda(totalVt)}
          subtitulo={`${elegiveisVt} elegíveis${resumoDoMes?.informado ? " · informado" : ""}`}
        />
        <StatCard
          titulo="Vale-mobilidade"
          valor={formatarMoeda(totalVm)}
          subtitulo={`${elegiveisVm} elegíveis${resumoDoMes?.informado ? " · informado" : ""}`}
        />
        <StatCard
          titulo="Vale-refeição"
          valor={formatarMoeda(totalVa)}
          subtitulo={`${elegiveisVa} elegíveis${resumoDoMes?.informado ? " · informado" : ""}`}
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
          VT/VM/VR de {competenciaExibida(competencia)} vêm do total informado pelo DP, conferido com a operadora — o
          rateio por colaborador abaixo continua calculado pelo cadastro e pode não fechar exatamente com esse total.
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
                  <span className="text-brand-primary-800">Vale-refeição/alimentação</span>
                  <span className="text-brand-primary-800">{formatarMoeda(s.va)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">Brindes/Presentes</span>
                  <span className="text-foreground">{formatarMoeda(s.brindes)}</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-1 font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-brand-primary-800">{formatarMoeda(s.total)}</span>
                </div>
              </div>
            </div>
          ))}
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
