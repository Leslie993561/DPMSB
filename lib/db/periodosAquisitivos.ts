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

function calcularCiclos(dataAdmissao: string, hoje: Date): { inicio: string; fim: string }[] {
  const ciclos: { inicio: string; fim: string }[] = [];
  let cicloInicio = new Date(dataAdmissao);
  while (cicloInicio <= hoje) {
    const cicloFim = new Date(cicloInicio);
    cicloFim.setMonth(cicloFim.getMonth() + 12);
    ciclos.push({ inicio: cicloInicio.toISOString().slice(0, 10), fim: cicloFim.toISOString().slice(0, 10) });
    cicloInicio = cicloFim;
  }
  return ciclos;
}

/**
 * Insere várias linhas (colaborador_id, data_inicio, data_fim) num só
 * `INSERT ... VALUES (...), (...), ...` — contra um banco remoto, uma query
 * com N grupos de valores custa uma ida-e-volta de rede; N queries separadas
 * (mesmo em uma transação) custam N idas-e-voltas, uma por statement.
 */
async function inserirCiclosEmLote(linhas: { colaboradorId: number; inicio: string; fim: string }[]): Promise<void> {
  if (linhas.length === 0) return;
  const db = await getDb();
  const grupos = linhas.map(() => "(?, ?, ?)").join(", ");
  const args = linhas.flatMap((l) => [l.colaboradorId, l.inicio, l.fim]);
  await db.execute({
    sql: `INSERT INTO periodos_aquisitivos (colaborador_id, data_inicio, data_fim) VALUES ${grupos} ON CONFLICT (colaborador_id, data_inicio) DO NOTHING`,
    args,
  });
}

/**
 * Gera (idempotente, via UNIQUE + ON CONFLICT DO NOTHING) todos os ciclos de
 * 12 meses entre a data de admissão do colaborador e hoje que ainda não existem.
 */
export async function sincronizarPeriodos(colaboradorId: number, dataAdmissao: string, hoje: Date): Promise<void> {
  const ciclos = calcularCiclos(dataAdmissao, hoje);
  await inserirCiclosEmLote(ciclos.map((c) => ({ colaboradorId, inicio: c.inicio, fim: c.fim })));
}

/**
 * Mesma sincronização de `sincronizarPeriodos`, mas para vários colaboradores
 * de uma vez, numa única query — evita N idas-e-voltas sequenciais ao banco
 * (relevante com um banco remoto; em SQLite local a diferença nem aparecia).
 */
async function sincronizarPeriodosEmLote(
  colaboradores: { id: number; dataAdmissao: string }[],
  hoje: Date,
): Promise<void> {
  const linhas = colaboradores.flatMap((c) =>
    calcularCiclos(c.dataAdmissao, hoje).map((ciclo) => ({ colaboradorId: c.id, inicio: ciclo.inicio, fim: ciclo.fim })),
  );
  await inserirCiclosEmLote(linhas);
}

export async function listarPeriodosPorColaborador(colaboradorId: number): Promise<PeriodoAquisitivo[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM periodos_aquisitivos WHERE colaborador_id = ? ORDER BY data_inicio",
    args: [colaboradorId],
  });
  return (resultado.rows as unknown as LinhaPeriodo[]).map(paraPeriodo);
}

export async function buscarPeriodo(id: number): Promise<PeriodoAquisitivo | null> {
  const db = await getDb();
  const resultado = await db.execute({ sql: "SELECT * FROM periodos_aquisitivos WHERE id = ?", args: [id] });
  const linha = resultado.rows[0] as unknown as LinhaPeriodo | undefined;
  return linha ? paraPeriodo(linha) : null;
}

interface LinhaLancamentoResumo {
  periodo_aquisitivo_id: number;
  dias: number;
  status: "programada" | "concluida" | "cancelada" | "alterada";
  data_inicio_prevista: string | null;
  data_inicio_gozo: string | null;
}

/**
 * Todos os lançamentos ativos (não cancelados), de TODOS os períodos, numa
 * query só — evita N+1 (uma query por período) ao montar `listarPeriodosAbertos`.
 */
async function buscarTodosLancamentosAtivos(): Promise<Map<number, LinhaLancamentoResumo[]>> {
  const db = await getDb();
  const resultado = await db.execute(
    "SELECT periodo_aquisitivo_id, dias, status, data_inicio_prevista, data_inicio_gozo FROM lancamentos_ferias WHERE status != 'cancelada'",
  );
  const linhas = resultado.rows as unknown as LinhaLancamentoResumo[];
  const porPeriodo = new Map<number, LinhaLancamentoResumo[]>();
  for (const l of linhas) {
    const lista = porPeriodo.get(l.periodo_aquisitivo_id) ?? [];
    lista.push(l);
    porPeriodo.set(l.periodo_aquisitivo_id, lista);
  }
  return porPeriodo;
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
function enriquecerPeriodo(
  periodo: PeriodoAquisitivo,
  colaborador: Colaborador,
  hoje: Date,
  lancamentosResumo: LinhaLancamentoResumo[],
): PeriodoAquisitivoAberto {
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
export async function listarPeriodosAbertos(): Promise<PeriodoAquisitivoAberto[]> {
  const hoje = new Date();
  const colaboradores = await listarColaboradores();

  await sincronizarPeriodosEmLote(colaboradores, hoje);

  const db = await getDb();
  const [resultado, lancamentosPorPeriodo] = await Promise.all([
    db.execute("SELECT * FROM periodos_aquisitivos ORDER BY data_inicio"),
    buscarTodosLancamentosAtivos(),
  ]);
  const linhas = resultado.rows as unknown as LinhaPeriodo[];

  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));
  const maisRecentePorColaborador = new Map<number, PeriodoAquisitivoAberto>();

  for (const linha of linhas) {
    const periodo = paraPeriodo(linha);
    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;

    // Ainda dentro do período aquisitivo (não fechou) — não conta como aberto/vencido ainda.
    if (new Date(periodo.dataFim) > hoje) continue;

    const candidato = enriquecerPeriodo(periodo, colaborador, hoje, lancamentosPorPeriodo.get(periodo.id) ?? []);
    if (candidato.diasATirar <= 0) continue;

    const existente = maisRecentePorColaborador.get(periodo.colaboradorId);
    if (!existente || periodo.dataFim > existente.dataFim) {
      maisRecentePorColaborador.set(periodo.colaboradorId, candidato);
    }
  }

  return Array.from(maisRecentePorColaborador.values());
}

/** Histórico completo (todos os períodos, resolvidos ou não) de um único colaborador — usado na exportação "por colaborador". */
export async function listarHistoricoColaborador(colaboradorId: number): Promise<PeriodoAquisitivoAberto[]> {
  const hoje = new Date();
  const colaborador = (await listarColaboradores()).find((c) => c.id === colaboradorId);
  if (!colaborador) return [];

  await sincronizarPeriodos(colaborador.id, colaborador.dataAdmissao, hoje);

  const db = await getDb();
  const [resultado, lancamentosPorPeriodo] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM periodos_aquisitivos WHERE colaborador_id = ? ORDER BY data_inicio",
      args: [colaboradorId],
    }),
    buscarTodosLancamentosAtivos(),
  ]);
  const linhas = resultado.rows as unknown as LinhaPeriodo[];

  return linhas.map((linha) => {
    const periodo = paraPeriodo(linha);
    return enriquecerPeriodo(periodo, colaborador, hoje, lancamentosPorPeriodo.get(periodo.id) ?? []);
  });
}
