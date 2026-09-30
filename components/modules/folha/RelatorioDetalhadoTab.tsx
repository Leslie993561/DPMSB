"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatarNumero, formatarNumeroOuTraco, formatarMoeda } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/shared/Card";
import { RiskCallout } from "@/components/shared/RiskCallout";
import { cn } from "@/lib/cn";
import { formatarHoras } from "@/lib/folha/horas";
import { useSessaoResumo } from "@/lib/authClient";

interface VerbaColaborador {
  colaboradorId: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  salarioBase: number;
  inss: number;
  irrf: number;
  fgts: number;
  provisaoDecimoTerceiro: number;
  valeTransporte: number;
  valeAlimentacao: number;
  auxilioEducacao: number;
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  solidesSaude: number | null;
  flash: number | null;
  totalPass: number | null;
  bonificacao: number | null;
  outrosCustos: number | null;
  premiacao: number;
  /** HORAS decimais lançadas na planilha (8,0167 = 08:01). */
  horaExtra50: number | null;
  horaExtra100: number | null;
  descontoHoras: number | null;
  horaNoturna: number | null;
  valorHoras: {
    valorHoraNormal: number;
    extra50: number;
    extra100: number;
    desconto: number;
    noturna: number;
    dsr: number;
    liquido: number;
  };
  salarioFamilia: number;
  dependentesSalarioFamilia: number;
  periculosidade: number;
  insalubridade: number;
  adicionalFixo: number;
  custoTotal: number;
  variaveis: number;
  encargosDiretos: number;
  provisoes: number;
  encargosSobreProvisoes: number;
  regimeEncargos: "celetista" | "aprendiz" | null;
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_COMPLETOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const MESES_ABREV3 = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaCurta(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_ABREV3[mes - 1]}/${ano}`;
}

function competenciaLonga(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return `${MESES_COMPLETOS[mes - 1]} de ${ano}`;
}

function totalEncargos(l: VerbaColaborador): number {
  return l.inss + l.fgts + l.provisaoDecimoTerceiro;
}

const FONTE_NUMERO = "[font-family:Arial,_Helvetica,_sans-serif]";
const TH_GRUPO = "px-3 py-1 text-center text-[9.5px] font-bold tracking-wide uppercase";
const TH_COL = "px-3 py-1 text-right text-[9.5px] font-semibold tracking-wide uppercase";
const TD_NUM = cn("px-3 py-1 text-right text-[11px] tabular-nums text-foreground", FONTE_NUMERO);

const GRUPO_ENCARGOS = "bg-status-warning-bg";
const GRUPO_BENEFICIOS = "bg-brand-primary-100";
const GRUPO_PLATAFORMAS = "bg-[#EAF1F3]";
const GRUPO_OUTROS = "bg-[#E9EEF1]";
const GRUPO_HORAS = "bg-[#F0EDF6]";
const DIVISOR = "border-l-2 border-hairline";

/** Uma linha da composição de custo, com o percentual quando houver. */
function LinhaCusto({ rotulo, percentual, valor }: { rotulo: string; percentual?: string; valor: number }) {
  return (
    <span className="flex justify-between gap-2 text-foreground-muted">
      <span>
        {rotulo}
        {percentual && <span className="ml-1 opacity-70">{percentual}</span>}
      </span>
      <span className="tabular-nums">{formatarNumero(valor)}</span>
    </span>
  );
}

export function RelatorioDetalhadoTab() {
  // Gestor liberado pro Breakdown só enxerga: edição (fechar/reabrir mês),
  // importar planilha e exportar ficam só com o RH.
  const sessao = useSessaoResumo();
  const souGestor = sessao?.tipo === "gestor";
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [linhas, setLinhas] = useState<VerbaColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [setorTabela, setSetorTabela] = useState("");
  const [exportarAberto, setExportarAberto] = useState(false);
  const [importarAberto, setImportarAberto] = useState(false);
  const [fechado, setFechado] = useState(false);
  const [competenciasFechadas, setCompetenciasFechadas] = useState<string[]>([]);
  const [fechando, setFechando] = useState(false);
  const [erroFechar, setErroFechar] = useState<string | null>(null);

  async function recarregar() {
    try {
      const res = await fetch(`/api/folha-breakdown?competencia=${competencia}`);
      const data = await res.json();
      setLinhas(data.linhas ?? []);
      setFechado(Boolean(data.fechado));
      setCompetenciasFechadas(data.competenciasFechadas ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia]);

  /**
   * Fechar grava um retrato do breakdown que não muda mais, mesmo que o
   * cadastro (salário, vínculo, benefícios) seja editado depois — é o que
   * garante que mexer em agosto não altere julho já fechado. Reabrir descarta
   * esse retrato e devolve o mês ao cálculo ao vivo.
   *
   * Reabrir pede confirmação porque é irreversível: os valores congelados não
   * voltam, só podem ser refeitos com o cadastro de agora, que pode já estar
   * diferente do que era quando o mês fechou.
   */
  async function alternarFechamento() {
    if (fechado) {
      const confirmou = window.confirm(
        `Reabrir ${competenciaCurta(competencia)}?\n\nOs valores congelados serão descartados e o mês volta a ser ` +
          "calculado com o cadastro atual. Não há como recuperar o retrato anterior.",
      );
      if (!confirmou) return;
    }

    setErroFechar(null);
    setFechando(true);
    try {
      const res = await fetch(`/api/folha-breakdown/${fechado ? "reabrir" : "fechar"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroFechar(data.erro ?? `Erro ao ${fechado ? "reabrir" : "fechar"} o mês.`);
        return;
      }
      await recarregar();
    } catch {
      setErroFechar("Falha de comunicação com o servidor.");
    } finally {
      setFechando(false);
    }
  }

  const setores = useMemo(
    () => Array.from(new Set(linhas.map((l) => l.departamento).filter((d): d is string => Boolean(d)))).sort(),
    [linhas],
  );

  const linhasFiltradas = useMemo(
    () => (setorTabela ? linhas.filter((l) => l.departamento === setorTabela) : linhas),
    [linhas, setorTabela],
  );

  const totais = useMemo(
    () =>
      linhasFiltradas.reduce(
        (acc, l) => ({
          salarioBase: acc.salarioBase + l.salarioBase,
          inss: acc.inss + l.inss,
          fgts: acc.fgts + l.fgts,
          provisao: acc.provisao + l.provisaoDecimoTerceiro,
          encargos: acc.encargos + totalEncargos(l),
          vt: acc.vt + l.valeTransporte,
          va: acc.va + l.valeAlimentacao,
          auxilioEducacao: acc.auxilioEducacao + l.auxilioEducacao,
          vm: acc.vm + (l.vm ?? 0),
          odontologico: acc.odontologico + (l.odontologico ?? 0),
          solides: acc.solides + (l.solides ?? 0),
          solidesSaude: acc.solidesSaude + (l.solidesSaude ?? 0),
          flash: acc.flash + (l.flash ?? 0),
          totalPass: acc.totalPass + (l.totalPass ?? 0),
          premiacao: acc.premiacao + l.premiacao,
          bonificacao: acc.bonificacao + (l.bonificacao ?? 0),
          variaveis: acc.variaveis + (l.variaveis ?? 0),
          salarioFamilia: acc.salarioFamilia + l.salarioFamilia,
          periculosidade: acc.periculosidade + l.periculosidade,
          insalubridade: acc.insalubridade + l.insalubridade,
          adicionalFixo: acc.adicionalFixo + l.adicionalFixo,
          horaExtra50: acc.horaExtra50 + (l.horaExtra50 ?? 0),
          horaExtra100: acc.horaExtra100 + (l.horaExtra100 ?? 0),
          descontoHoras: acc.descontoHoras + (l.descontoHoras ?? 0),
          horaNoturna: acc.horaNoturna + (l.horaNoturna ?? 0),
          valorHoras: acc.valorHoras + l.valorHoras.liquido,
          dsrHoras: acc.dsrHoras + l.valorHoras.dsr,
          custoTotal: acc.custoTotal + l.custoTotal,
        }),
        {
          periculosidade: 0,
          insalubridade: 0,
          adicionalFixo: 0,
          salarioFamilia: 0,
          horaExtra50: 0,
          horaExtra100: 0,
          descontoHoras: 0,
          horaNoturna: 0,
          valorHoras: 0,
          dsrHoras: 0,
          salarioBase: 0,
          inss: 0,
          fgts: 0,
          provisao: 0,
          encargos: 0,
          vt: 0,
          va: 0,
          auxilioEducacao: 0,
          vm: 0,
          odontologico: 0,
          solides: 0,
          solidesSaude: 0,
          flash: 0,
          totalPass: 0,
          premiacao: 0,
          bonificacao: 0,
          variaveis: 0,
          custoTotal: 0,
        },
      ),
    [linhasFiltradas],
  );

  return (
    <div className="space-y-4">
      {/* Mesmo cabeçalho do resto do portal: trilha, título e subtítulo à
          esquerda, ações na mesma linha à direita. Antes esta aba desenhava um
          cabeçalho próprio, com outro tamanho de título e sem o cartão. */}
      <PageHeader
        eyebrow="Breakdown · custo da folha"
        titulo="Relatório detalhado da folha"
        subtitulo="Importe o relatório da folha para atualizar o breakdown de custo por colaborador"
        acao={
          souGestor ? undefined : (
            <div className="flex flex-wrap items-center gap-2">
              <ExportarPopover
                aberto={exportarAberto}
                onAbrir={() => {
                  setExportarAberto((v) => !v);
                  setImportarAberto(false);
                }}
                onFechar={() => setExportarAberto(false)}
                competencia={competencia}
                linhas={linhas}
                setores={setores}
              />
              <ImportarPopover
                aberto={importarAberto}
                onAbrir={() => {
                  setImportarAberto((v) => !v);
                  setExportarAberto(false);
                }}
                onFechar={() => setImportarAberto(false)}
                competenciaInicial={competencia}
                onImportado={() => void recarregar()}
              />
            </div>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-bold text-foreground">Custo total</h3>
            <span className="rounded-full bg-brand-primary-100 px-2 py-0.5 text-[10.5px] font-bold text-brand-primary-800">
              {competenciaCurta(competencia)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {souGestor ? (
              fechado && (
                <span className="flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-1 text-[10.5px] font-bold text-status-success">
                  <span aria-hidden>🔒</span> Mês fechado
                </span>
              )
            ) : fechado ? (
              <button
                type="button"
                onClick={() => void alternarFechamento()}
                disabled={fechando}
                title="Mês fechado: os valores são um retrato gravado e não mudam mais. Clique para reabrir e voltar ao cálculo ao vivo."
                className="group/selo flex items-center gap-1 rounded-full border border-status-success-border bg-status-success-bg px-2.5 py-1 text-[10.5px] font-bold text-status-success transition-colors hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger disabled:opacity-50"
              >
                <span aria-hidden>🔒</span>
                <span className="group-hover/selo:hidden">{fechando ? "Reabrindo…" : "Mês fechado"}</span>
                <span className="hidden group-hover/selo:inline">{fechando ? "Reabrindo…" : "Reabrir mês"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void alternarFechamento()}
                disabled={fechando || linhasFiltradas.length === 0}
                title="Grava um retrato desta competência. Depois de fechado, editar o cadastro não altera mais estes valores."
                className="rounded-md border border-hairline px-2.5 py-1 text-[11px] font-semibold text-foreground-muted transition-colors hover:border-brand-primary hover:text-brand-primary-800 disabled:opacity-50 dark:border-brand-neutral/30"
              >
                {fechando ? "Fechando…" : "🔒 Fechar mês"}
              </button>
            )}
            <p className="text-[10px] text-foreground-muted">colaborador, cargo e salário fixos · demais rolam</p>
          </div>
        </div>

        {erroFechar && (
          <p className="border-b border-hairline bg-status-danger-bg px-4 py-2 text-[11.5px] text-status-danger">
            {erroFechar}
          </p>
        )}

        <div className="flex items-center gap-1 overflow-x-auto border-b border-hairline bg-surface-page px-4 py-2">
          <span className="mr-2 shrink-0 text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
            Competência {competencia.slice(0, 4)}
          </span>
          {MESES_ABREV.map((m, i) => {
            const mesNum = i + 1;
            const alvo = `${competencia.slice(0, 4)}-${String(mesNum).padStart(2, "0")}`;
            const ativo = Number(competencia.slice(5, 7)) === mesNum;
            // O cadeado deixa visível, sem precisar clicar, quais meses já
            // estão congelados — é a informação que responde "posso mexer?".
            const mesFechado = competenciasFechadas.includes(alvo);
            return (
              <button
                key={m}
                type="button"
                onClick={() => setCompetencia(alvo)}
                title={mesFechado ? "Mês fechado" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                  ativo ? "bg-brand-primary text-brand-white" : "text-foreground-muted hover:bg-brand-primary-050",
                )}
              >
                {m}
                {mesFechado && (
                  <span aria-hidden className={cn("text-[9px]", ativo ? "text-brand-white/80" : "text-status-success")}>
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {carregando ? (
          <p className="p-6 text-sm text-foreground-muted">Carregando...</p>
        ) : linhasFiltradas.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-muted">Nenhum colaborador para esta competência/setor.</p>
        ) : (
          <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[1400px] text-[11px]">
              <thead className="sticky top-0 z-30">
                <tr className="border-b border-hairline">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-40 min-w-[200px] border-r border-hairline bg-background px-3 py-1 text-left align-bottom"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                        Colaborador
                      </span>
                      <select
                        value={setorTabela}
                        onChange={(e) => setSetorTabela(e.target.value)}
                        className="rounded border border-hairline bg-background px-1 py-0.5 text-[9.5px] text-foreground-muted"
                      >
                        <option value="">Todos os setores</option>
                        {setores.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[200px] z-40 min-w-[100px] border-r border-hairline bg-background px-3 py-1 text-right align-bottom text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase"
                  >
                    Salário
                  </th>
                  <th colSpan={4} className={cn(TH_GRUPO, DIVISOR, "border-b border-hairline", GRUPO_ENCARGOS, "text-status-warning")}>
                    Encargos
                  </th>
                  <th colSpan={6} className={cn(TH_GRUPO, DIVISOR, "border-b border-hairline", GRUPO_BENEFICIOS, "text-brand-primary-800")}>
                    Benefícios
                  </th>
                  <th colSpan={4} className={cn(TH_GRUPO, DIVISOR, "border-b border-hairline", GRUPO_PLATAFORMAS, "text-brand-primary-800")}>
                    Plataformas
                  </th>
                  <th
                    colSpan={6}
                    className={cn(TH_GRUPO, DIVISOR, "border-b border-hairline", GRUPO_HORAS, "text-foreground-muted")}
                    title="Horas lançadas na planilha (hh:mm); o total é em reais, calculado pelo salário."
                  >
                    Hora extra
                  </th>
                  <th colSpan={6} className={cn(TH_GRUPO, DIVISOR, "border-b border-hairline", GRUPO_OUTROS, "text-foreground-muted")}>
                    Outros
                  </th>
                  <th rowSpan={2} className={cn(DIVISOR, "min-w-[130px] bg-brand-dark-900 px-3 py-2 text-right align-bottom text-[9.5px] font-bold tracking-wide text-white uppercase")}>
                    Total do colaborador
                  </th>
                </tr>
                <tr className="border-b border-hairline">
                  <th className={cn(TH_COL, DIVISOR, GRUPO_ENCARGOS, "text-status-warning")}>INSS</th>
                  <th className={cn(TH_COL, GRUPO_ENCARGOS, "text-status-warning")}>FGTS</th>
                  <th className={cn(TH_COL, GRUPO_ENCARGOS, "text-status-warning")}>Provisão 13º</th>
                  <th className={cn(TH_COL, GRUPO_ENCARGOS, "text-status-warning")}>Total encargos</th>
                  <th className={cn(TH_COL, DIVISOR, GRUPO_BENEFICIOS, "text-brand-primary-800")}>VT</th>
                  <th className={cn(TH_COL, GRUPO_BENEFICIOS, "text-brand-primary-800")}>VA</th>
                  <th className={cn(TH_COL, GRUPO_BENEFICIOS, "text-brand-primary-800")}>Auxílio educação</th>
                  <th className={cn(TH_COL, GRUPO_BENEFICIOS, "text-brand-primary-800")}>VM</th>
                  <th className={cn(TH_COL, GRUPO_BENEFICIOS, "text-brand-primary-800")}>Odontológico</th>
                  <th
                    className={cn(TH_COL, GRUPO_BENEFICIOS, "text-brand-primary-800")}
                    title="Cota por filho menor de 14 anos (Lei 8.213/91). Adiantado pelo empregador e compensado na guia do INSS — por isso não entra no total do colaborador."
                  >
                    Salário família
                  </th>
                  <th className={cn(TH_COL, DIVISOR, GRUPO_PLATAFORMAS, "text-brand-primary-800")}>Sólides</th>
                  <th className={cn(TH_COL, GRUPO_PLATAFORMAS, "text-brand-primary-800")}>Flash</th>
                  <th className={cn(TH_COL, GRUPO_PLATAFORMAS, "text-brand-primary-800")}>TotalPass</th>
                  <th className={cn(TH_COL, GRUPO_PLATAFORMAS, "text-brand-primary-800")}>Sólides (Saúde)</th>
                  <th className={cn(TH_COL, DIVISOR, GRUPO_HORAS, "text-foreground-muted")}>Hora extra 50% (h)</th>
                  <th className={cn(TH_COL, GRUPO_HORAS, "text-foreground-muted")}>Hora extra 100% (h)</th>
                  <th className={cn(TH_COL, GRUPO_HORAS, "text-foreground-muted")} title="Subtrai do total do colaborador">
                    Desconto de horas (h)
                  </th>
                  <th className={cn(TH_COL, GRUPO_HORAS, "text-foreground-muted")}>Hora noturna (h)</th>
                  {/* O DSR é verba própria na folha; esconder num tooltip
                      obrigaria a refazer a conta para conferir o holerite. */}
                  <th
                    className={cn(TH_COL, GRUPO_HORAS, "text-foreground-muted")}
                    title="Reflexo no descanso semanal remunerado: adicionais ÷ dias úteis × dias de DSR do mês"
                  >
                    DSR s/ HE (R$)
                  </th>
                  {/* A coluna que fecha o grupo: as horas todas convertidas em
                      dinheiro, já com o adicional de cada tipo e o desconto
                      subtraído. É este valor que entra no total do colaborador. */}
                  <th
                    className={cn(TH_COL, GRUPO_HORAS, "font-bold text-foreground")}
                    title="Soma em reais: 50% + 100% + adicional noturno − desconto"
                  >
                    Total (R$)
                  </th>
                  <th className={cn(TH_COL, DIVISOR, GRUPO_OUTROS, "text-foreground-muted")}>Premiação</th>
                  <th className={cn(TH_COL, GRUPO_OUTROS, "text-foreground-muted")}>Bonificação</th>
                  {/* Vem do Rateio de Benefícios: aniversário do mês e o que
                      foi informado na planilha de rateio. */}
                  <th className={cn(TH_COL, GRUPO_OUTROS, "text-foreground-muted")}>Variáveis</th>
                  <th
                    className={cn(TH_COL, GRUPO_OUTROS, "text-foreground-muted")}
                    title="30% sobre o salário base (Art. 193 CLT) — vem do cadastro do colaborador"
                  >
                    Periculosidade
                  </th>
                  <th
                    className={cn(TH_COL, GRUPO_OUTROS, "text-foreground-muted")}
                    title="10/20/40% sobre o salário mínimo (Art. 192 CLT) — vem do cadastro do colaborador"
                  >
                    Insalubridade
                  </th>
                  <th className={cn(TH_COL, GRUPO_OUTROS, "text-foreground-muted")}>Adicional fixo</th>
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.map((l) => (
                  <tr key={l.colaboradorId} className="border-b border-hairline/60 last:border-0">
                    <td className="sticky left-0 z-10 border-r border-hairline bg-background px-3 py-1">
                      <div className="text-[11px] font-semibold text-foreground-muted uppercase">{l.nome}</div>
                      <div className="text-[9px] text-foreground-muted normal-case">
                        {l.cargo ?? "—"} · {l.departamento ?? "—"}
                      </div>
                    </td>
                    <td className={cn("sticky left-[200px] z-10 border-r border-hairline bg-background px-3 py-1 text-right text-[11px] tabular-nums text-foreground", FONTE_NUMERO)}>
                      {formatarNumero(l.salarioBase)}
                    </td>
                    <td className={cn(TD_NUM, DIVISOR, GRUPO_ENCARGOS)}>{formatarNumero(l.inss)}</td>
                    <td className={cn(TD_NUM, GRUPO_ENCARGOS)}>{formatarNumero(l.fgts)}</td>
                    <td className={cn(TD_NUM, GRUPO_ENCARGOS)}>{formatarNumero(l.provisaoDecimoTerceiro)}</td>
                    <td className={cn(TD_NUM, GRUPO_ENCARGOS, "font-bold")}>{formatarNumero(totalEncargos(l))}</td>
                    <td className={cn(TD_NUM, DIVISOR, GRUPO_BENEFICIOS)}>{formatarNumero(l.valeTransporte)}</td>
                    <td className={cn(TD_NUM, GRUPO_BENEFICIOS)}>{formatarNumero(l.valeAlimentacao)}</td>
                    <td className={cn(TD_NUM, GRUPO_BENEFICIOS)}>{formatarNumeroOuTraco(l.auxilioEducacao || null)}</td>
                    <td className={cn(TD_NUM, GRUPO_BENEFICIOS)}>{formatarNumeroOuTraco(l.vm)}</td>
                    <td className={cn(TD_NUM, GRUPO_BENEFICIOS)}>{formatarNumeroOuTraco(l.odontologico)}</td>
                    <td
                      className={cn(TD_NUM, GRUPO_BENEFICIOS)}
                      title={
                        l.dependentesSalarioFamilia > 0
                          ? `${l.dependentesSalarioFamilia} filho(s) menor(es) de 14 anos`
                          : "Nenhum filho menor de 14 anos com data de nascimento no cadastro"
                      }
                    >
                      {formatarNumero(l.salarioFamilia)}
                    </td>
                    <td className={cn(TD_NUM, DIVISOR, GRUPO_PLATAFORMAS)}>{formatarNumeroOuTraco(l.solides)}</td>
                    <td className={cn(TD_NUM, GRUPO_PLATAFORMAS)}>{formatarNumeroOuTraco(l.flash)}</td>
                    <td className={cn(TD_NUM, GRUPO_PLATAFORMAS)}>{formatarNumeroOuTraco(l.totalPass)}</td>
                    <td className={cn(TD_NUM, GRUPO_PLATAFORMAS)}>{formatarNumeroOuTraco(l.solidesSaude)}</td>
                    <td
                      className={cn(TD_NUM, DIVISOR, GRUPO_HORAS)}
                      title={l.horaExtra50 ? `${formatarMoeda(l.valorHoras.extra50)} — hora normal ${formatarMoeda(l.valorHoras.valorHoraNormal)} × 1,5` : undefined}
                    >
                      {l.horaExtra50 ? formatarHoras(l.horaExtra50) : "—"}
                    </td>
                    <td
                      className={cn(TD_NUM, GRUPO_HORAS)}
                      title={l.horaExtra100 ? `${formatarMoeda(l.valorHoras.extra100)} — hora normal ${formatarMoeda(l.valorHoras.valorHoraNormal)} × 2` : undefined}
                    >
                      {l.horaExtra100 ? formatarHoras(l.horaExtra100) : "—"}
                    </td>
                    <td
                      className={cn(TD_NUM, GRUPO_HORAS, l.descontoHoras ? "text-status-danger" : undefined)}
                      title={l.descontoHoras ? `-${formatarMoeda(l.valorHoras.desconto)} — hora normal, sem adicional` : undefined}
                    >
                      {l.descontoHoras ? `-${formatarHoras(l.descontoHoras)}` : "—"}
                    </td>
                    <td
                      className={cn(TD_NUM, GRUPO_HORAS)}
                      title={l.horaNoturna ? `${formatarMoeda(l.valorHoras.noturna)} — adicional noturno de 20% (Art. 73 CLT)` : undefined}
                    >
                      {l.horaNoturna ? formatarHoras(l.horaNoturna) : "—"}
                    </td>
                    <td
                      className={cn(TD_NUM, GRUPO_HORAS)}
                      title={l.valorHoras.dsr ? "Adicionais do mês ÷ dias úteis × dias de DSR" : undefined}
                    >
                      {l.valorHoras.dsr ? formatarNumero(l.valorHoras.dsr) : "—"}
                    </td>
                    <td
                      className={cn(
                        TD_NUM,
                        GRUPO_HORAS,
                        "font-bold",
                        l.valorHoras.liquido < 0 ? "text-status-danger" : undefined,
                      )}
                      title={
                        l.valorHoras.liquido !== 0
                          ? [
                              `Hora normal: ${formatarMoeda(l.valorHoras.valorHoraNormal)}`,
                              `50%: ${formatarMoeda(l.valorHoras.extra50)}`,
                              `100%: ${formatarMoeda(l.valorHoras.extra100)}`,
                              `Adicional noturno: ${formatarMoeda(l.valorHoras.noturna)}`,
                              `DSR: ${formatarMoeda(l.valorHoras.dsr)}`,
                              `(–) Desconto: ${formatarMoeda(l.valorHoras.desconto)}`,
                            ].join("\n")
                          : undefined
                      }
                    >
                      {l.valorHoras.liquido !== 0 ? formatarNumero(l.valorHoras.liquido) : "—"}
                    </td>
                    <td className={cn(TD_NUM, DIVISOR, GRUPO_OUTROS)}>{formatarNumero(l.premiacao)}</td>
                    <td className={cn(TD_NUM, GRUPO_OUTROS)}>{formatarNumeroOuTraco(l.bonificacao)}</td>
                    <td className={cn(TD_NUM, GRUPO_OUTROS)}>{formatarNumeroOuTraco(l.variaveis || null)}</td>
                    <td className={cn(TD_NUM, GRUPO_OUTROS)}>{formatarNumeroOuTraco(l.periculosidade || null)}</td>
                    <td className={cn(TD_NUM, GRUPO_OUTROS)}>{formatarNumeroOuTraco(l.insalubridade || null)}</td>
                    <td className={cn(TD_NUM, GRUPO_OUTROS)}>{formatarNumeroOuTraco(l.adicionalFixo || null)}</td>
                    <td className={cn(DIVISOR, "bg-brand-dark-900/5 px-3 py-1 text-right text-[11px] font-bold tabular-nums text-foreground", FONTE_NUMERO)}>
                      {/* O custo total abre a composição do empregador — a mesma
                          do demonstrativo do DP: encargos diretos, provisões e
                          os encargos que incidem sobre elas. Jovem aprendiz tem
                          FGTS de 2%, então cai em 28,80% em vez de 34,80%. */}
                      {l.regimeEncargos ? (
                        <span className="group relative inline-flex justify-end">
                          <span tabIndex={0} role="button" className="cursor-help underline decoration-dotted underline-offset-2">
                            {formatarNumero(l.custoTotal)}
                          </span>
                          <span className="pointer-events-none absolute top-full right-0 z-50 hidden w-60 rounded-lg border border-hairline bg-background p-2.5 text-left text-[10.5px] font-normal shadow-lg group-hover:block group-focus-within:block dark:border-brand-neutral/30">
                            <span className="block font-semibold text-foreground">
                              Custo mensal folha ·{" "}
                              {l.regimeEncargos === "aprendiz" ? "jovem aprendiz" : "celetista"}
                            </span>
                            <LinhaCusto rotulo="Salário" valor={l.salarioBase} />
                            <LinhaCusto
                              rotulo="Encargos diretos"
                              percentual={l.regimeEncargos === "aprendiz" ? "28,80%" : "34,80%"}
                              valor={l.encargosDiretos}
                            />
                            <LinhaCusto rotulo="Provisões" percentual="19,44%" valor={l.provisoes} />
                            <LinhaCusto
                              rotulo="Sobre as provisões"
                              percentual={l.regimeEncargos === "aprendiz" ? "5,60%" : "6,77%"}
                              valor={l.encargosSobreProvisoes}
                            />
                            <span className="mt-1 block border-t border-hairline pt-1 text-foreground-muted">
                              Benefícios e verbas do mês entram no total da coluna.
                            </span>
                          </span>
                        </span>
                      ) : (
                        formatarNumero(l.custoTotal)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-30">
                <tr className="border-t-2 border-hairline bg-surface-page font-bold">
                  <td className="sticky left-0 z-40 border-r border-hairline bg-surface-page px-3 py-1 text-[11px] text-foreground">
                    Total ({linhasFiltradas.length})
                  </td>
                  <td className={cn("sticky left-[200px] z-40 border-r border-hairline bg-surface-page px-3 py-1 text-right text-[11px] tabular-nums text-foreground", FONTE_NUMERO)}>
                    {formatarNumero(totais.salarioBase)}
                  </td>
                  <td className={cn(TD_NUM, DIVISOR, "bg-surface-page")}>{formatarNumero(totais.inss)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.fgts)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.provisao)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.encargos)}</td>
                  <td className={cn(TD_NUM, DIVISOR, "bg-surface-page")}>{formatarNumero(totais.vt)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.va)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.auxilioEducacao)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.vm)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.odontologico)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.salarioFamilia)}</td>
                  <td className={cn(TD_NUM, DIVISOR, "bg-surface-page")}>{formatarNumero(totais.solides)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.flash)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.totalPass)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.solidesSaude)}</td>
                  <td
                    className={cn(TD_NUM, DIVISOR, "bg-surface-page")}
                    title={`Efeito líquido das horas no custo: ${formatarMoeda(totais.valorHoras)}`}
                  >
                    {formatarHoras(totais.horaExtra50)}
                  </td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarHoras(totais.horaExtra100)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page", totais.descontoHoras ? "text-status-danger" : undefined)}>
                    {totais.descontoHoras ? `-${formatarHoras(totais.descontoHoras)}` : "00:00"}
                  </td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarHoras(totais.horaNoturna)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.dsrHoras)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page font-bold", totais.valorHoras < 0 ? "text-status-danger" : undefined)}>
                    {formatarNumero(totais.valorHoras)}
                  </td>
                  <td className={cn(TD_NUM, DIVISOR, "bg-surface-page")}>{formatarNumero(totais.premiacao)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.bonificacao)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.variaveis)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.periculosidade)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.insalubridade)}</td>
                  <td className={cn(TD_NUM, "bg-surface-page")}>{formatarNumero(totais.adicionalFixo)}</td>
                  <td className={cn(DIVISOR, "bg-brand-dark-900 px-3 py-1 text-right text-[11px] tabular-nums text-white", FONTE_NUMERO)}>
                    {formatarNumero(totais.custoTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ExportarPopover({
  aberto,
  onAbrir,
  onFechar,
  competencia,
  linhas,
  setores,
}: {
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  competencia: string;
  linhas: VerbaColaborador[];
  setores: string[];
}) {
  const [setor, setSetor] = useState("");
  const linhasFiltradas = setor ? linhas.filter((l) => l.departamento === setor) : linhas;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onAbrir}
        className={cn(
          "flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-700",
          aberto && "ring-2 ring-[#E6A020] ring-offset-1",
        )}
      >
        <span aria-hidden>📄</span> Exportar planilha <span aria-hidden className="text-[9px]">▾</span>
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={onFechar} />
          {/* Abre para BAIXO: o botão fica no topo da página e, aberto para cima, o painel saía da área visível. */}
          <div className="absolute top-full right-0 z-50 mt-1.5 max-h-[70vh] w-[320px] overflow-y-auto rounded-md border border-hairline bg-background p-4 shadow-drawer">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-bold text-foreground">Opção 1 · Exportar planilha</p>
              <span className="shrink-0 rounded-full bg-brand-primary-100 px-2 py-0.5 text-[9.5px] font-bold text-brand-primary-800">
                Excel · 34 colunas
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
              Gera um arquivo .xlsx com uma linha por colaborador e uma coluna para cada verba: salário base, INSS,
              FGTS, provisão de 13º, total de encargos, VT, VA, auxílio educação, VM, odontológico, salário família,
              Sólides, Flash, TotalPass, Sólides (Saúde), hora extra 50% e 100%, desconto de horas, hora noturna,
              premiação, bonificação, variáveis, periculosidade, insalubridade, adicional fixo e custo total.
            </p>

            <label className="mt-3 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              O que exportar
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal text-foreground normal-case"
              >
                <option value="">Todos os setores</option>
                {setores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-foreground-muted">
              <span>Competência {competenciaCurta(competencia)}</span>
              <span>{linhasFiltradas.length} linhas</span>
            </div>

            <a
              href={`/api/folha-breakdown/exportar?competencia=${competencia}${setor ? `&setor=${encodeURIComponent(setor)}` : ""}`}
              download
              onClick={onFechar}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-700"
            >
              ↓ Exportar planilha
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function ImportarPopover({
  aberto,
  onAbrir,
  onFechar,
  competenciaInicial,
  onImportado,
}: {
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  competenciaInicial: string;
  onImportado: () => void;
}) {
  const [mesReferencia, setMesReferencia] = useState(competenciaInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    aplicadas: number;
    colunasOutros: string[];
    colunasNaoEncontradas: string[];
    cabecalhosDoArquivo: string[];
    horasSuspeitas: { linha: number; colaborador: string; coluna: string; valor: string; motivo: string }[];
    descartados: { linha: number; motivo: string }[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function aplicar() {
    if (!arquivo) {
      setErro("Anexe a planilha (ou PDF) antes de continuar.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      formData.append("competencia", mesReferencia);
      const res = await fetch("/api/folha-breakdown/extras", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler a planilha.");
        return;
      }
      setResultado(data);
      onImportado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onAbrir}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary-800 dark:border-brand-neutral/30",
          aberto && "ring-2 ring-[#E6A020] ring-offset-1",
        )}
      >
        <span aria-hidden>📥</span> Importar planilha <span aria-hidden className="text-[9px]">▾</span>
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={onFechar} />
          {/* Para baixo, pelo mesmo motivo do popover de exportar. */}
          <div className="absolute top-full right-0 z-50 mt-1.5 max-h-[70vh] w-[340px] overflow-y-auto rounded-md border border-hairline bg-background p-4 shadow-drawer">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12.5px] font-bold text-foreground">Opção 2 · Importar planilha</p>
              <a
                href="/api/folha-breakdown/extras/modelo"
                download
                className="shrink-0 text-[11px] font-semibold text-brand-primary-800 hover:underline"
              >
                Baixar modelo
              </a>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
              A leitura identifica cada verba pelo cabeçalho da coluna e distribui os valores; colunas não
              reconhecidas entram como &quot;Outros custos&quot;.
            </p>

            <label className="mt-3 block text-[10px] font-semibold tracking-wide text-foreground-muted uppercase">
              Mês de referência da planilha
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                className="mt-1 w-full rounded-md border border-hairline bg-background px-2.5 py-1.5 text-[12px] font-normal text-foreground normal-case"
              />
            </label>

            <label className="mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 border-dashed border-hairline px-4 py-5 text-center hover:border-brand-primary">
              <span aria-hidden className="text-xl text-brand-primary">
                ☁
              </span>
              <span className="text-[12px] font-medium text-foreground">
                {arquivo ? arquivo.name : "Arraste a planilha aqui ou clique para anexar"}
              </span>
              <span className="text-[10px] text-foreground-muted">XLSX, XLS, CSV ou PDF · até 10 MB</span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                onChange={(e) => {
                  setResultado(null);
                  setErro(null);
                  setArquivo(e.target.files?.[0] ?? null);
                }}
              />
            </label>

            {erro && (
              <div className="mt-2.5">
                <RiskCallout nivel="critico">{erro}</RiskCallout>
              </div>
            )}
            {resultado && (
              <div className="mt-2.5">
                {/* O desfecho vem antes dos números: com linhas descartadas a
                    importação não foi concluída por inteiro, e isso precisa
                    estar dito com todas as letras, não deduzido da contagem. */}
                <RiskCallout
                  nivel={
                    resultado.descartados.length > 0 || resultado.horasSuspeitas?.length > 0 ? "atencao" : "sucesso"
                  }
                >
                  <strong>
                    {resultado.descartados.length > 0
                      ? `Concluída em parte — ${resultado.aplicadas} de ${resultado.aplicadas + resultado.descartados.length} linha(s)`
                      : `Concluída — ${resultado.aplicadas} linha(s) aplicada(s)`}
                  </strong>
                  {resultado.colunasOutros.length > 0 && (
                    <span className="mt-1 block">
                      Colunas somadas em &quot;Outros custos&quot;: {resultado.colunasOutros.join(", ")}
                    </span>
                  )}
                  {resultado.horasSuspeitas?.length > 0 && (
                    <>
                      <span className="mt-1 block font-semibold">
                        ⚠ {resultado.horasSuspeitas.length} célula(s) de hora com problema:
                      </span>
                      <ul className="mt-1 list-inside list-disc">
                        {resultado.horasSuspeitas.slice(0, 6).map((h, i) => (
                          <li key={i}>
                            Linha {h.linha}: {h.colaborador} · {h.coluna} = {h.valor} — {h.motivo}
                          </li>
                        ))}
                        {resultado.horasSuspeitas.length > 6 && (
                          <li>… e mais {resultado.horasSuspeitas.length - 6}</li>
                        )}
                      </ul>
                    </>
                  )}
                  {resultado.colunasNaoEncontradas?.length > 0 && (
                    <span className="mt-1 block">
                      ⚠ Não veio no arquivo, continua como estava:{" "}
                      {resultado.colunasNaoEncontradas.join(", ")}
                    </span>
                  )}
                  {/* Os cabeçalhos crus resolvem a dúvida mais comum — "mas eu
                      preenchi essa coluna!" — mostrando com que nome ela veio. */}
                  {resultado.cabecalhosDoArquivo?.length > 0 && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11.5px] font-normal">
                        Colunas lidas do arquivo ({resultado.cabecalhosDoArquivo.length})
                      </summary>
                      <span className="mt-1 block text-[11px] font-normal opacity-90">
                        {resultado.cabecalhosDoArquivo.join(" · ")}
                      </span>
                    </details>
                  )}
                  {resultado.descartados.length > 0 && (
                    <>
                      <span className="mt-1 block">
                        {resultado.descartados.length} linha(s) NÃO aplicada(s):
                      </span>
                      <ul className="mt-1 list-inside list-disc">
                        {resultado.descartados.slice(0, 5).map((d, i) => (
                          <li key={i}>
                            Linha {d.linha}: {d.motivo}
                          </li>
                        ))}
                        {resultado.descartados.length > 5 && (
                          <li>… e mais {resultado.descartados.length - 5}</li>
                        )}
                      </ul>
                    </>
                  )}
                </RiskCallout>
              </div>
            )}

            <button
              type="button"
              onClick={aplicar}
              disabled={enviando || !arquivo}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-700 disabled:opacity-50"
            >
              {enviando ? "Lendo..." : `✓ Ler planilha e aplicar em ${competenciaLonga(mesReferencia)}`}
            </button>

            <ImportarSalariosSecao onAplicado={onImportado} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Opção 3" do popover de importar: lê o Recibo de Pagamento + o Relatório de
 * Líquidos (os dois PDFs que a folha mensal já gera) e atualiza o Salário
 * Base do cadastro de quem mudou. Só o salário é gravado — INSS, FGTS e IRRF
 * continuam saindo do cálculo automático (gerarBreakdown), então corrigir o
 * salário aqui já corrige o Breakdown inteiro sozinho.
 */
function ImportarSalariosSecao({ onAplicado }: { onAplicado: () => void }) {
  const [reciboArquivo, setReciboArquivo] = useState<File | null>(null);
  const [liquidosArquivo, setLiquidosArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    linhas: { colaboradorId: number; nome: string; salarioAtual: number; salarioNovo: number; mudou: boolean }[];
    descartados: { codigo: string; nome: string; motivo: string }[];
  } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [aplicadas, setAplicadas] = useState<number | null>(null);

  async function ler() {
    if (!reciboArquivo || !liquidosArquivo) {
      setErro("Anexe os dois arquivos: Recibo de Pagamento e Relatório de Líquidos.");
      return;
    }
    setErro(null);
    setAplicadas(null);
    setLendo(true);
    try {
      const formData = new FormData();
      formData.append("recibo", reciboArquivo);
      formData.append("liquidos", liquidosArquivo);
      const res = await fetch("/api/colaboradores/atualizar-salarios", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao ler os arquivos.");
        return;
      }
      setPreview(data);
      setSelecionados(
        new Set(
          (data.linhas as { colaboradorId: number; mudou: boolean }[])
            .filter((l) => l.mudou)
            .map((l) => l.colaboradorId),
        ),
      );
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setLendo(false);
    }
  }

  async function aplicar() {
    if (!preview) return;
    const atualizacoes = preview.linhas
      .filter((l) => selecionados.has(l.colaboradorId))
      .map((l) => ({ colaboradorId: l.colaboradorId, salarioBase: l.salarioNovo }));
    if (atualizacoes.length === 0) return;
    setErro(null);
    setAplicando(true);
    try {
      const res = await fetch("/api/colaboradores/atualizar-salarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atualizacoes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro ?? "Erro ao aplicar as atualizações.");
        return;
      }
      setAplicadas(data.aplicadas);
      setPreview(null);
      setReciboArquivo(null);
      setLiquidosArquivo(null);
      onAplicado();
    } catch {
      setErro("Falha de comunicação com o servidor.");
    } finally {
      setAplicando(false);
    }
  }

  const linhasComMudanca = preview?.linhas.filter((l) => l.mudou) ?? [];

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <p className="text-[12.5px] font-bold text-foreground">Opção 3 · Atualizar salários (Recibo de Pagamento)</p>
      <p className="mt-2 text-[11px] leading-relaxed text-foreground-muted">
        Lê o Recibo de Pagamento e o Relatório de Líquidos do mesmo mês (os dois PDFs que a folha já gera), casa cada
        pessoa pelo CPF (pelo nome, se faltar CPF) e mostra quem mudou de Salário Base antes de gravar. INSS, FGTS e
        IRRF não são importados — continuam calculados a partir do salário.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-hairline px-3 py-2.5 text-center text-[11.5px] font-medium text-foreground hover:border-brand-primary">
        {reciboArquivo ? reciboArquivo.name : "📄 Recibo de Pagamento (PDF)"}
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            setPreview(null);
            setErro(null);
            setAplicadas(null);
            setReciboArquivo(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-hairline px-3 py-2.5 text-center text-[11.5px] font-medium text-foreground hover:border-brand-primary">
        {liquidosArquivo ? liquidosArquivo.name : "📄 Relatório de Líquidos (PDF)"}
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            setPreview(null);
            setErro(null);
            setAplicadas(null);
            setLiquidosArquivo(e.target.files?.[0] ?? null);
          }}
        />
      </label>

      {erro && (
        <div className="mt-2.5">
          <RiskCallout nivel="critico">{erro}</RiskCallout>
        </div>
      )}

      {aplicadas !== null && (
        <div className="mt-2.5">
          <RiskCallout nivel="sucesso">
            <strong>{aplicadas} colaborador(es) com o Salário Base atualizado.</strong>
          </RiskCallout>
        </div>
      )}

      {!preview && (
        <button
          type="button"
          onClick={ler}
          disabled={lendo || !reciboArquivo || !liquidosArquivo}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary-800 disabled:opacity-50"
        >
          {lendo ? "Lendo..." : "Ler arquivos e comparar"}
        </button>
      )}

      {preview && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-foreground-muted">
            {linhasComMudanca.length} de {preview.linhas.length} vieram com salário diferente do cadastro.
          </p>

          {linhasComMudanca.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-md border border-hairline">
              <table className="w-full text-[11px]">
                <thead className="bg-surface-page text-left text-[9.5px] font-semibold tracking-wide text-foreground-muted uppercase">
                  <tr>
                    <th className="px-2 py-1"></th>
                    <th className="px-2 py-1">Nome</th>
                    <th className="px-2 py-1 text-right">Atual</th>
                    <th className="px-2 py-1 text-right">Novo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {linhasComMudanca.map((l) => (
                    <tr key={l.colaboradorId}>
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selecionados.has(l.colaboradorId)}
                          onChange={(e) =>
                            setSelecionados((atual) => {
                              const novo = new Set(atual);
                              if (e.target.checked) novo.add(l.colaboradorId);
                              else novo.delete(l.colaboradorId);
                              return novo;
                            })
                          }
                        />
                      </td>
                      <td className="max-w-[110px] truncate px-2 py-1 text-foreground" title={l.nome}>
                        {l.nome}
                      </td>
                      <td className="px-2 py-1 text-right text-foreground-muted">{formatarMoeda(l.salarioAtual)}</td>
                      <td className="px-2 py-1 text-right font-semibold text-brand-primary-800">
                        {formatarMoeda(l.salarioNovo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.descartados.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] text-foreground-muted">
                {preview.descartados.length} não encontrado(s) no cadastro
              </summary>
              <ul className="mt-1 list-inside list-disc text-[10.5px] text-foreground-muted">
                {preview.descartados.map((d, i) => (
                  <li key={i}>
                    {d.nome}: {d.motivo}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button
            type="button"
            onClick={aplicar}
            disabled={aplicando || selecionados.size === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-brand-white transition-colors hover:bg-brand-primary-700 disabled:opacity-50"
          >
            {aplicando ? "Aplicando..." : `✓ Atualizar ${selecionados.size} colaborador(es)`}
          </button>
        </div>
      )}
    </div>
  );
}
