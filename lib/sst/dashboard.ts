import "server-only";
import { sstQuery } from "./db";
import { listarColaboradoresParaEpi } from "./epi";
import {
  CATALOGO_EXAMES_OCUPACIONAIS,
  computeProgramaStatus,
  deptName,
  idadeFromISO,
  mesAbrev,
  mesISOfromBR,
  parseBR,
  pgValueToIso,
  statusDoRegistro,
  statusFichaEpi,
  titleCase,
  toneForStatus,
  versoesMaisRecentes,
  type BadgeTone,
  type ExameRegistro,
  type StatusExame,
  type StatusPrograma,
} from "./domain";

// ---------- linhas cruas do Postgres do SST ----------

interface ColaboradorRow {
  id: number;
  cpf: string | null;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  epis: string[] | null;
  exames: ExameRegistro[] | null;
  nascimento: unknown;
  desligado: boolean | null;
  data_desligamento: unknown;
  motivo_desligamento: string | null;
  desligado_by: string | null;
}

interface EntregaEpiRow {
  colab_id: number;
  valor_unit: number;
  qtd: number;
  data_entrega: string;
  ficha_id: string | null;
}

interface CustoEpiMesRow {
  mes: string;
  orcado: number;
  realizado_base: number;
}

interface FardamentoEntregaRow {
  colab_id: number;
  valor_unit: number;
  qtd: number;
  data_entrega: string;
}

interface FardamentoReparoRow {
  colab_id: number;
  valor: number;
  data_reparo: string;
}

interface CustoFardamentoMesRow {
  mes: string;
  orcado: number;
  entrega_base: number;
  reparo_base: number;
}

interface ExamePrecoRow {
  codigo: string;
  valor: number;
}

interface AnexoExameRow {
  valor: number;
}

interface FichaEpiRow {
  id: string;
  colab_id: number;
  assinatura_storage_path: string | null;
  status: string | null;
}

interface AsoDemissionalPendenteRow {
  colab_id: number;
  desligado_em: string;
  motivo: string;
  solicitado_por: string;
  ts: string;
}

interface ProgramaSaudeRow {
  programa: string;
  vigencia_fim: string;
  precisao_fim: "dia" | "mes";
  ts: string;
}

interface DesligamentoPendenteRow {
  colaborador_nome: string;
  data_desligamento: unknown;
  motivo: string;
  solicitado_por: string;
  criado_em: string;
}

/** Executa uma query não-crítica e devolve `[]` (com log) se falhar — mesmo espírito
 * de resiliência do `PortalStoreContext.tsx` original: cada carga é independente, uma
 * falha isolada não derruba o resto do Dashboard. */
async function tolerante<T extends object>(nome: string, sql: string): Promise<T[]> {
  try {
    return await sstQuery<T>(sql);
  } catch (erro) {
    console.error(`[sst/dashboard] Falha ao consultar ${nome}`, erro);
    return [];
  }
}

export interface RankedRow {
  nome: string;
  qtd: number;
  valor: number;
  media?: number;
  pct: number;
}

export interface PendenciaRow {
  nome: string;
  departamento: string;
  item: string;
  vencimento: string;
  diasAtraso: number | null;
  status: StatusExame;
  tone: BadgeTone;
}

export interface CustoMesEpi {
  mes: string;
  mesLabel: string;
  orcado: number;
  realizado: number;
  dif: number;
  pctConsumo: number;
  pctTone: BadgeTone;
}

export interface CustoMesFardamento {
  mes: string;
  mesLabel: string;
  entrega: number;
  reparo: number;
  realizado: number;
  orcado: number;
  dif: number;
}

export interface DesligamentoPendenteLinha {
  colabId: number;
  nome: string;
  cargo: string;
  departamento: string;
  dataDesligamento: string;
  motivo: string;
  solicitadoPor: string;
}

export interface AsoDemissionalPendenteLinha {
  colabId: number;
  nome: string;
  cargo: string;
  departamento: string;
  desligadoEm: string;
  motivo: string;
  solicitadoPor: string;
}

export interface ProgramaAtencao {
  programa: string;
  status: StatusPrograma;
}

export interface DashboardSst {
  kpi: {
    colaboradores: number;
    classificados: number;
    asoEmDia: number;
    aVencer: number;
    pendencias: number;
  };
  pctEmDia: number;
  donutLegend: { label: string; count: number; color: string }[];
  pendenciaRows: PendenciaRow[];
  custoEpi: {
    orcadoAno: number;
    realizadoAno: number;
    difAno: number;
    pctAno: number;
    meses: CustoMesEpi[];
    porDepartamento: RankedRow[];
    porColaborador: RankedRow[];
  };
  custoFardamento: {
    entregasAno: number;
    reparosAno: number;
    orcadoAno: number;
    difAno: number;
    meses: CustoMesFardamento[];
    porDepartamento: RankedRow[];
    porColaborador: RankedRow[];
  };
  exames: {
    previsto: number;
    examesComValor: number;
    catExamesCount: number;
    realizado: number;
    examesRealizadosCount: number;
    dif: number;
    hasPrevisto: boolean;
  };
  fichasEpi: {
    total: number;
    assinadas: number;
    aguardando: number;
    semFicha: number;
  };
  desligamentosPendentes: DesligamentoPendenteLinha[];
  asoDemissionalPendentes: AsoDemissionalPendenteLinha[];
  programasAtencao: ProgramaAtencao[];
}

function ranking(entries: Map<string, number>, counts: Map<string, number>, withMedia = false): RankedRow[] {
  const max = Math.max(1, ...entries.values());
  return [...entries.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor]) => ({
      nome,
      qtd: counts.get(nome) ?? 0,
      valor,
      media: withMedia ? valor / Math.max(1, counts.get(nome) ?? 1) : undefined,
      pct: Math.round((100 * valor) / max),
    }));
}

/**
 * Monta todos os dados do Dashboard SST a partir do Postgres do Portal SST
 * (SST_DATABASE_URL) — porta fielmente a agregação de
 * `portal-sst/src/features/dashboard/useDashboardData.ts`, só trocando "ler
 * de state em memória" por "ler do resultado de umas SELECTs amplas".
 */
export async function obterDashboardSst(): Promise<DashboardSst> {
  const hoje = new Date();

  const [
    colaboradoresRows,
    entregasEpiRows,
    custosEpiMesRows,
    fardamentoEntregasRows,
    fardamentoReparosRows,
    custosFardamentoMesRows,
    examePrecosRows,
    anexosExamesRows,
    fichasEpiRows,
    asoDemissionalPendentesRows,
    programasSaudeRows,
    desligamentosPendentesRows,
  ] = await Promise.all([
    tolerante<ColaboradorRow>(
      "colaboradores",
      "SELECT id, cpf, nome, cargo, departamento, epis, exames, nascimento, desligado, data_desligamento, motivo_desligamento, desligado_by FROM colaboradores",
    ),
    tolerante<EntregaEpiRow>("sst_entregas_epi", "SELECT colab_id, valor_unit, qtd, data_entrega, ficha_id FROM sst_entregas_epi"),
    tolerante<CustoEpiMesRow>("sst_custos_epi_mes", "SELECT mes, orcado, realizado_base FROM sst_custos_epi_mes ORDER BY mes ASC"),
    tolerante<FardamentoEntregaRow>(
      "sst_fardamento_entregas",
      "SELECT colab_id, valor_unit, qtd, data_entrega FROM sst_fardamento_entregas",
    ),
    tolerante<FardamentoReparoRow>("sst_fardamento_reparos", "SELECT colab_id, valor, data_reparo FROM sst_fardamento_reparos"),
    tolerante<CustoFardamentoMesRow>(
      "sst_custos_fardamento_mes",
      "SELECT mes, orcado, entrega_base, reparo_base FROM sst_custos_fardamento_mes ORDER BY mes ASC",
    ),
    tolerante<ExamePrecoRow>("sst_exame_precos", "SELECT codigo, valor FROM sst_exame_precos"),
    tolerante<AnexoExameRow>("sst_anexos_exames", "SELECT valor FROM sst_anexos_exames"),
    tolerante<FichaEpiRow>("sst_fichas_epi", "SELECT id, colab_id, assinatura_storage_path, status FROM sst_fichas_epi"),
    tolerante<AsoDemissionalPendenteRow>(
      "sst_aso_demissional_pendentes",
      "SELECT colab_id, desligado_em, motivo, solicitado_por, ts FROM sst_aso_demissional_pendentes ORDER BY ts ASC",
    ),
    tolerante<ProgramaSaudeRow>(
      "sst_programas_saude",
      "SELECT programa, vigencia_fim, precisao_fim, ts FROM sst_programas_saude ORDER BY ts DESC",
    ),
    // Tabela `peopleflow_desligamento_pendente` pertence ao Portal PeopleFlow (outro app),
    // não ao schema do próprio Portal SST (não está em portal-sst/supabase/schema.sql) —
    // mesmo projeto Supabase, tabela de outro repositório. Tolerante por padrão: se um dia
    // deixar de existir/mudar de nome, o Dashboard só fica sem este card, não quebra.
    tolerante<DesligamentoPendenteRow>(
      "peopleflow_desligamento_pendente",
      "SELECT colaborador_nome, data_desligamento, motivo, solicitado_por, criado_em FROM peopleflow_desligamento_pendente ORDER BY criado_em ASC",
    ),
  ]);

  // ---------- colaboradores ativos + exames ----------

  const colaboradoresAtivos = colaboradoresRows.filter((c) => !c.desligado);

  const contextoIdade = (colab: ColaboradorRow) => ({
    idadeColab: idadeFromISO(pgValueToIso(colab.nascimento)),
    catalogo: CATALOGO_EXAMES_OCUPACIONAIS,
  });

  const exames: { colab: ColaboradorRow; exame: ExameRegistro }[] = [];
  colaboradoresAtivos.forEach((c) => (c.exames ?? []).forEach((exame) => exames.push({ colab: c, exame })));

  const statusCount: Record<StatusExame, number> = {
    "Em dia": 0,
    "A vencer": 0,
    Vencido: 0,
    "Necessita revisão": 0,
    Pendente: 0,
  };
  exames.forEach(({ colab, exame }) => {
    statusCount[statusDoRegistro(exame, hoje, contextoIdade(colab))]++;
  });

  const classificados = colaboradoresAtivos.filter((c) => c.epis && c.epis.length > 0).length;
  const totalExames = exames.length || 1;
  const pctEmDia = Math.round((100 * statusCount["Em dia"]) / totalExames);

  const pendenciaRows: PendenciaRow[] = exames
    .filter(({ colab, exame }) => {
      const st = statusDoRegistro(exame, hoje, contextoIdade(colab));
      return st === "Vencido" || st === "Necessita revisão";
    })
    .slice(0, 8)
    .map(({ colab, exame }) => {
      const status = statusDoRegistro(exame, hoje, contextoIdade(colab));
      const proximaData = parseBR(exame.proximo);
      const diasAtraso = status === "Vencido" && proximaData ? Math.round((hoje.getTime() - proximaData.getTime()) / 86_400_000) : null;
      return {
        nome: titleCase(colab.nome),
        departamento: deptName(colab.departamento),
        item: exame.proc,
        vencimento: exame.proximo,
        diasAtraso,
        status,
        tone: toneForStatus(status),
      };
    });

  const kpi = {
    colaboradores: colaboradoresAtivos.length,
    classificados,
    asoEmDia: statusCount["Em dia"],
    aVencer: statusCount["A vencer"],
    pendencias: statusCount.Vencido + statusCount["Necessita revisão"],
  };

  const donutLegend = [
    { label: "Em dia", count: statusCount["Em dia"], color: "var(--color-status-success)" },
    { label: "A vencer", count: statusCount["A vencer"], color: "var(--color-status-warning)" },
    { label: "Vencido", count: statusCount.Vencido, color: "var(--color-status-danger)" },
    { label: "Necessita revisão", count: statusCount["Necessita revisão"], color: "var(--color-brand-primary-800)" },
  ];

  // ---------- custos de EPI ----------

  const colabById = new Map(colaboradoresRows.map((c) => [c.id, c]));

  const realizadoByMes: Record<string, number> = {};
  entregasEpiRows.forEach((e) => {
    const mes = mesISOfromBR(e.data_entrega);
    if (!mes) return;
    realizadoByMes[mes] = (realizadoByMes[mes] ?? 0) + Number(e.valor_unit) * Number(e.qtd);
  });

  const custoMesesEpi: CustoMesEpi[] = custosEpiMesRows.map((r) => {
    const realizado = Number(r.realizado_base) + (realizadoByMes[r.mes] ?? 0);
    const orcado = Number(r.orcado);
    const dif = realizado - orcado;
    const pctConsumo = orcado > 0 ? Math.round((100 * realizado) / orcado) : 0;
    const [ano, mes] = r.mes.split("-");
    return {
      mes: r.mes,
      mesLabel: `${mesAbrev(Number(mes))}/${ano.slice(2)}`,
      orcado,
      realizado,
      dif,
      pctConsumo,
      pctTone: pctConsumo > 100 ? "danger" : pctConsumo >= 90 ? "warning" : "success",
    };
  });
  const custoOrcAno = custoMesesEpi.reduce((acc, m) => acc + m.orcado, 0);
  const custoRealAno = custoMesesEpi.reduce((acc, m) => acc + m.realizado, 0);
  const custoDifAno = custoRealAno - custoOrcAno;
  const custoPctAno = custoOrcAno > 0 ? Math.round((100 * custoRealAno) / custoOrcAno) : 0;

  const epiValorByDept = new Map<string, number>();
  const epiQtdByDept = new Map<string, number>();
  const epiValorByColab = new Map<string, number>();
  const epiQtdByColab = new Map<string, number>();
  entregasEpiRows.forEach((e) => {
    const c = colabById.get(e.colab_id);
    const dept = deptName(c?.departamento);
    const nome = titleCase(c?.nome ?? "—");
    const valor = Number(e.valor_unit) * Number(e.qtd);
    epiValorByDept.set(dept, (epiValorByDept.get(dept) ?? 0) + valor);
    epiQtdByDept.set(dept, (epiQtdByDept.get(dept) ?? 0) + Number(e.qtd));
    epiValorByColab.set(nome, (epiValorByColab.get(nome) ?? 0) + valor);
    epiQtdByColab.set(nome, (epiQtdByColab.get(nome) ?? 0) + Number(e.qtd));
  });
  const epiCustoDeptRows = ranking(epiValorByDept, epiQtdByDept, true);
  const epiCustoColabRows = ranking(epiValorByColab, epiQtdByColab);

  // ---------- custos de fardamento ----------

  const fardEntregaByMes: Record<string, number> = {};
  fardamentoEntregasRows.forEach((e) => {
    const mes = mesISOfromBR(e.data_entrega);
    if (!mes) return;
    fardEntregaByMes[mes] = (fardEntregaByMes[mes] ?? 0) + Number(e.valor_unit) * Number(e.qtd);
  });
  const fardReparoByMes: Record<string, number> = {};
  fardamentoReparosRows.forEach((r) => {
    const mes = mesISOfromBR(r.data_reparo);
    if (!mes) return;
    fardReparoByMes[mes] = (fardReparoByMes[mes] ?? 0) + Number(r.valor);
  });

  const custoMesesFard: CustoMesFardamento[] = custosFardamentoMesRows.map((r) => {
    const entrega = Number(r.entrega_base) + (fardEntregaByMes[r.mes] ?? 0);
    const reparo = Number(r.reparo_base) + (fardReparoByMes[r.mes] ?? 0);
    const realizado = entrega + reparo;
    const orcado = Number(r.orcado);
    const dif = realizado - orcado;
    const [ano, mes] = r.mes.split("-");
    return {
      mes: r.mes,
      mesLabel: `${mesAbrev(Number(mes))}/${ano.slice(2)}`,
      orcado,
      entrega,
      reparo,
      realizado,
      dif,
    };
  });
  const fardEntAno = custoMesesFard.reduce((acc, m) => acc + m.entrega, 0);
  const fardRepAno = custoMesesFard.reduce((acc, m) => acc + m.reparo, 0);
  const fardOrcAno = custoMesesFard.reduce((acc, m) => acc + m.orcado, 0);
  const fardDifAno = fardEntAno + fardRepAno - fardOrcAno;

  const fardValorByDept = new Map<string, number>();
  const fardQtdByDept = new Map<string, number>();
  const fardValorByColab = new Map<string, number>();
  const fardQtdByColab = new Map<string, number>();
  fardamentoEntregasRows.forEach((e) => {
    const c = colabById.get(e.colab_id);
    const dept = deptName(c?.departamento);
    const nome = titleCase(c?.nome ?? "—");
    const valor = Number(e.valor_unit) * Number(e.qtd);
    fardValorByDept.set(dept, (fardValorByDept.get(dept) ?? 0) + valor);
    fardQtdByDept.set(dept, (fardQtdByDept.get(dept) ?? 0) + Number(e.qtd));
    fardValorByColab.set(nome, (fardValorByColab.get(nome) ?? 0) + valor);
    fardQtdByColab.set(nome, (fardQtdByColab.get(nome) ?? 0) + Number(e.qtd));
  });
  fardamentoReparosRows.forEach((r) => {
    const c = colabById.get(r.colab_id);
    const dept = deptName(c?.departamento);
    const nome = titleCase(c?.nome ?? "—");
    fardValorByDept.set(dept, (fardValorByDept.get(dept) ?? 0) + Number(r.valor));
    fardValorByColab.set(nome, (fardValorByColab.get(nome) ?? 0) + Number(r.valor));
  });
  const fardCustoDeptRows = ranking(fardValorByDept, fardQtdByDept);
  const fardCustoColabRows = ranking(fardValorByColab, fardQtdByColab);

  // ---------- exames ocupacionais: previsto x realizado ----------

  const examePrecoOverride = new Map(examePrecosRows.map((r) => [r.codigo, Number(r.valor)]));
  const catExames = CATALOGO_EXAMES_OCUPACIONAIS;
  const valorExame = (codigo: string) => examePrecoOverride.get(codigo) ?? catExames.find((e) => e.codigo === codigo)?.valor ?? 0;
  const examesComValor = catExames.filter((e) => valorExame(e.codigo) > 0).length;
  const previstoExamesAno = catExames.reduce((acc, e) => acc + valorExame(e.codigo) * (Number(e.cargos) || 0), 0);
  const realizadoExamesTotal = anexosExamesRows.reduce((acc, a) => acc + (Number(a.valor) || 0), 0);
  const examesRealizadosCount = anexosExamesRows.length;
  const difExamesSST = realizadoExamesTotal - previstoExamesAno;

  // ---------- fichas de EPI pendentes de assinatura ----------

  const totalFichasEpi = fichasEpiRows.length;
  // Assinada = assinatura eletrônica pelo link (status) ou PDF assinado anexado
  // (modelo antigo do Portal SST). O resto foi entregue e ainda não assinado.
  const fichasAssinadas = fichasEpiRows.filter(
    (f) => f.status === "assinada" || statusFichaEpi(f.assinatura_storage_path) === "assinada",
  ).length;
  const fichasAguardando = totalFichasEpi - fichasAssinadas;
  // Quem tem EPI obrigatório pela função (cadastro do Quadro × matriz) e ainda
  // não recebeu nenhuma ficha para assinar.
  const comFicha = new Set(fichasEpiRows.map((f) => Number(f.colab_id)));
  const entregasSemFicha = (await listarColaboradoresParaEpi()).filter(
    (c) => c.episObrigatorios.length > 0 && !comFicha.has(c.id),
  ).length;

  // ---------- desligamentos pendentes (Portal PeopleFlow) ----------

  const colabPorNome = new Map(colaboradoresRows.map((c) => [c.nome, c]));
  const desligamentosPendentes: DesligamentoPendenteLinha[] = desligamentosPendentesRows.flatMap((d) => {
    const colab = colabPorNome.get(d.colaborador_nome);
    if (!colab) return [];
    const dataIso = pgValueToIso(d.data_desligamento);
    return [
      {
        colabId: colab.id,
        nome: titleCase(d.colaborador_nome),
        cargo: colab.cargo ? titleCase(colab.cargo) : "—",
        departamento: deptName(colab.departamento),
        dataDesligamento: dataIso ? dataIso.split("-").reverse().join("/") : "A definir",
        motivo: d.motivo,
        solicitadoPor: d.solicitado_por,
      },
    ];
  });

  // ---------- ASO demissional pendente ----------

  const colabPorId = new Map(colaboradoresRows.map((c) => [c.id, c]));
  const asoDemissionalPendentes: AsoDemissionalPendenteLinha[] = asoDemissionalPendentesRows.flatMap((p) => {
    const colab = colabPorId.get(p.colab_id);
    if (!colab) return [];
    return [
      {
        colabId: p.colab_id,
        nome: titleCase(colab.nome),
        cargo: colab.cargo ? titleCase(colab.cargo) : "—",
        departamento: deptName(colab.departamento),
        desligadoEm: p.desligado_em,
        motivo: p.motivo,
        solicitadoPor: p.solicitado_por,
      },
    ];
  });

  // ---------- programas de saúde ocupacional (PCMSO/PGR) ----------

  const programasAtencao: ProgramaAtencao[] = versoesMaisRecentes(
    programasSaudeRows.map((p) => ({ programa: p.programa, vigenciaFim: p.vigencia_fim, precisaoFim: p.precisao_fim, ts: p.ts })),
  )
    .map((v) => ({ programa: v.programa, status: computeProgramaStatus(v.vigenciaFim, v.precisaoFim) }))
    .filter((p) => p.status !== "Vigente");

  return {
    kpi,
    pctEmDia,
    donutLegend,
    pendenciaRows,
    custoEpi: {
      orcadoAno: custoOrcAno,
      realizadoAno: custoRealAno,
      difAno: custoDifAno,
      pctAno: custoPctAno,
      meses: custoMesesEpi,
      porDepartamento: epiCustoDeptRows,
      porColaborador: epiCustoColabRows,
    },
    custoFardamento: {
      entregasAno: fardEntAno,
      reparosAno: fardRepAno,
      orcadoAno: fardOrcAno,
      difAno: fardDifAno,
      meses: custoMesesFard,
      porDepartamento: fardCustoDeptRows,
      porColaborador: fardCustoColabRows,
    },
    exames: {
      previsto: previstoExamesAno,
      examesComValor,
      catExamesCount: catExames.length,
      realizado: realizadoExamesTotal,
      examesRealizadosCount,
      dif: difExamesSST,
      hasPrevisto: previstoExamesAno > 0,
    },
    fichasEpi: {
      total: totalFichasEpi,
      assinadas: fichasAssinadas,
      aguardando: fichasAguardando,
      semFicha: entregasSemFicha,
    },
    desligamentosPendentes,
    asoDemissionalPendentes,
    programasAtencao,
  };
}
