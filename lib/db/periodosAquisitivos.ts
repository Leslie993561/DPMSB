import "server-only";
import { getDb } from "./client";
import { listarColaboradores, type Colaborador } from "./colaboradores";
import { calcularEstadoPeriodo, avaliarRiscoDobro, type LancamentoInfo } from "@/lib/ferias-gestao/validacoes";
import { avaliarPrazoConcessao } from "@/lib/calc";

export type StatusPeriodo = "aberto" | "concluido";

export interface PeriodoAquisitivo {
  id: number;
  colaboradorId: number;
  dataInicio: string;
  dataFim: string;
  diasDireito: number;
  abonoUtilizado: boolean;
  diasAbono: number;
  status: StatusPeriodo;
}

interface LinhaPeriodo {
  id: number;
  colaborador_id: number;
  data_inicio: string;
  data_fim: string;
  dias_direito: number;
  abono_utilizado: number;
  dias_abono: number;
  status: StatusPeriodo;
}

function paraPeriodo(linha: LinhaPeriodo): PeriodoAquisitivo {
  return {
    id: linha.id,
    colaboradorId: linha.colaborador_id,
    dataInicio: linha.data_inicio,
    dataFim: linha.data_fim,
    diasDireito: linha.dias_direito,
    abonoUtilizado: Boolean(linha.abono_utilizado),
    diasAbono: linha.dias_abono,
    status: linha.status,
  };
}

/**
 * Gera (idempotente, via UNIQUE + INSERT OR IGNORE) todos os ciclos de 12
 * meses entre a data de admissão do colaborador e hoje que ainda não existem.
 */
export function sincronizarPeriodos(colaboradorId: number, dataAdmissao: string, hoje: Date): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO periodos_aquisitivos (colaborador_id, data_inicio, data_fim) VALUES (?, ?, ?)`,
  );

  let cicloInicio = new Date(dataAdmissao);
  while (cicloInicio <= hoje) {
    const cicloFim = new Date(cicloInicio);
    cicloFim.setMonth(cicloFim.getMonth() + 12);

    insert.run(
      colaboradorId,
      cicloInicio.toISOString().slice(0, 10),
      cicloFim.toISOString().slice(0, 10),
    );
    cicloInicio = cicloFim;
  }
}

export function listarPeriodosPorColaborador(colaboradorId: number): PeriodoAquisitivo[] {
  const linhas = getDb()
    .prepare("SELECT * FROM periodos_aquisitivos WHERE colaborador_id = ? ORDER BY data_inicio")
    .all(colaboradorId) as unknown as LinhaPeriodo[];
  return linhas.map(paraPeriodo);
}

export function buscarPeriodo(id: number): PeriodoAquisitivo | null {
  const linha = getDb().prepare("SELECT * FROM periodos_aquisitivos WHERE id = ?").get(id) as
    | LinhaPeriodo
    | undefined;
  return linha ? paraPeriodo(linha) : null;
}

interface LinhaLancamentoResumo {
  dias: number;
  status: "programada" | "concluida" | "cancelada" | "alterada";
  data_inicio_prevista: string | null;
  data_inicio_gozo: string | null;
}

function buscarLancamentosAtivos(periodoId: number): LinhaLancamentoResumo[] {
  return getDb()
    .prepare(
      "SELECT dias, status, data_inicio_prevista, data_inicio_gozo FROM lancamentos_ferias WHERE periodo_aquisitivo_id = ? AND status != 'cancelada'",
    )
    .all(periodoId) as unknown as LinhaLancamentoResumo[];
}

export type SituacaoPeriodo = "vencida" | "a_vencer" | "programada";

export interface PeriodoAquisitivoAberto extends PeriodoAquisitivo {
  colaboradorNome: string;
  colaboradorCargo: string | null;
  colaboradorDepartamento: string | null;
  colaboradorCpf: string | null;
  colaboradorAdmissao: string;
  diasTirados: number;
  diasATirar: number;
  /** Saldo sem NENHUM lançamento (nem programado, nem confirmado) — usado pelo Dashboard para não contar 2x o que já tem lançamento real. */
  diasSemLancamento: number;
  fracionamentos: number;
  concessivoInicio: string;
  concessivoFim: string;
  diasParaVencer: number;
  vencida: boolean;
  alerta: boolean;
  situacao: SituacaoPeriodo;
  riscoDobro: boolean;
}

const DIAS_ALERTA_VENCIMENTO = 60;

/** Calcula todos os campos derivados (estado, concessivo, vencimento, situação) de um período para um colaborador. */
function enriquecerPeriodo(periodo: PeriodoAquisitivo, colaborador: Colaborador, hoje: Date): PeriodoAquisitivoAberto {
  const lancamentosResumo = buscarLancamentosAtivos(periodo.id);
  // Só férias já confirmadas (concluída/alterada) contam como "gozadas" aqui — uma
  // programação futura ainda não confirmada (Confirmar gozo) não deve reduzir o
  // saldo restante do Controle de Férias, só reserva a data no Planejamento.
  const confirmados = lancamentosResumo.filter((l) => l.status === "concluida" || l.status === "alterada");
  const estado = calcularEstadoPeriodo(
    periodo,
    confirmados.map((l): LancamentoInfo => ({ dias: l.dias })),
  );
  const estadoComProgramados = calcularEstadoPeriodo(
    periodo,
    lancamentosResumo.map((l): LancamentoInfo => ({ dias: l.dias })),
  );

  const prazo = avaliarPrazoConcessao(new Date(periodo.dataFim), hoje);
  const limiteConcessao = new Date(prazo.limiteConcessao);
  const diasParaVencer = Math.round((limiteConcessao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  const temProgramacao = lancamentosResumo.some((l) => l.status === "programada");
  const situacao: SituacaoPeriodo = temProgramacao ? "programada" : prazo.vencida ? "vencida" : "a_vencer";

  const proximaDataInicio = lancamentosResumo
    .map((l) => l.data_inicio_gozo ?? l.data_inicio_prevista)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const riscoDobro = avaliarRiscoDobro(limiteConcessao, proximaDataInicio ? new Date(proximaDataInicio) : null, hoje);

  return {
    ...periodo,
    colaboradorNome: colaborador.nome,
    colaboradorCargo: colaborador.cargo,
    colaboradorDepartamento: colaborador.departamento,
    colaboradorCpf: colaborador.cpf,
    colaboradorAdmissao: colaborador.dataAdmissao,
    diasTirados: estado.diasTirados,
    diasATirar: estado.diasATirar,
    diasSemLancamento: estadoComProgramados.diasATirar,
    fracionamentos: estado.fracionamentos,
    concessivoInicio: periodo.dataFim,
    concessivoFim: prazo.limiteConcessao,
    diasParaVencer,
    vencida: prazo.vencida,
    alerta: diasParaVencer < DIAS_ALERTA_VENCIMENTO,
    situacao,
    riscoDobro,
  };
}

/**
 * Sincroniza os períodos de todos os colaboradores e retorna, por
 * colaborador, o período aquisitivo "em aberto" (dias a tirar > 0) mais
 * relevante — já com o estado calculado e o destaque de vencimento
 * próximo/vencido/risco de dobro.
 *
 * Duas regras restringem o que conta como "em aberto":
 * 1. Um período AINDA EM CURSO (`dataFim` no futuro — os 12 meses de
 *    aquisição ainda não se completaram) nunca aparece aqui, mesmo que
 *    `diasDireito` já esteja cadastrado com o valor cheio (30) — o direito só
 *    é considerado vencido quando o período efetivamente fecha.
 * 2. Só o período JÁ FECHADO mais recente (maior `dataFim`) de cada
 *    colaborador é retornado — se houver saldo de um período ainda mais
 *    antigo, ele só volta a aparecer depois que o mais recente for resolvido.
 */
export function listarPeriodosAbertos(): PeriodoAquisitivoAberto[] {
  const hoje = new Date();
  const colaboradores = listarColaboradores();

  for (const colaborador of colaboradores) {
    sincronizarPeriodos(colaborador.id, colaborador.dataAdmissao, hoje);
  }

  const linhas = getDb()
    .prepare("SELECT * FROM periodos_aquisitivos ORDER BY data_inicio")
    .all() as unknown as LinhaPeriodo[];

  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));
  const maisRecentePorColaborador = new Map<number, PeriodoAquisitivoAberto>();

  for (const linha of linhas) {
    const periodo = paraPeriodo(linha);
    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;

    // Ainda dentro do período aquisitivo (não fechou) — não conta como aberto/vencido ainda.
    if (new Date(periodo.dataFim) > hoje) continue;

    const candidato = enriquecerPeriodo(periodo, colaborador, hoje);
    if (candidato.diasATirar <= 0) continue;

    const existente = maisRecentePorColaborador.get(periodo.colaboradorId);
    if (!existente || periodo.dataFim > existente.dataFim) {
      maisRecentePorColaborador.set(periodo.colaboradorId, candidato);
    }
  }

  return Array.from(maisRecentePorColaborador.values());
}

/** Histórico completo (todos os períodos, resolvidos ou não) de um único colaborador — usado na exportação "por colaborador". */
export function listarHistoricoColaborador(colaboradorId: number): PeriodoAquisitivoAberto[] {
  const hoje = new Date();
  const colaborador = listarColaboradores().find((c) => c.id === colaboradorId);
  if (!colaborador) return [];

  sincronizarPeriodos(colaborador.id, colaborador.dataAdmissao, hoje);

  const linhas = getDb()
    .prepare("SELECT * FROM periodos_aquisitivos WHERE colaborador_id = ? ORDER BY data_inicio")
    .all(colaboradorId) as unknown as LinhaPeriodo[];

  return linhas.map((linha) => enriquecerPeriodo(paraPeriodo(linha), colaborador, hoje));
}
