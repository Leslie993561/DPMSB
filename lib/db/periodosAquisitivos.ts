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

/*
 * NÃO existe mais geração automática de períodos aquisitivos.
 *
 * Antes, os períodos eram criados de 12 em 12 meses a partir da data de
 * admissão, a cada leitura da tela. Isso brigava com o relatório
 * "Programação de Férias" do DP, que é a fonte oficial: nele os períodos
 * podem estar deslocados do aniversário de admissão, porque afastamento e
 * licença suspendem a aquisição (a Janete, por exemplo, foi admitida em
 * 01/04/2015 e tem período aquisitivo começando em 07/12/2025). O resultado
 * eram dois conjuntos de períodos para a mesma pessoa e a mesma férias
 * contada duas vezes no Controle de Férias.
 *
 * Agora período aquisitivo entra no sistema só por importação do relatório
 * do DP (Controle de Férias → "Importar arquivo") ou pelo assistente de
 * Programação Anual. Colaborador que ainda não apareceu em nenhum relatório
 * fica sem período até a próxima importação — de propósito: é melhor não
 * mostrar nada do que mostrar um período que o DP não reconhece.
 */

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
  /**
   * Coluna "Limite p/ gozo" do relatório de Programação de Férias: última
   * data em que o SALDO deste período ainda pode começar a ser gozado e
   * terminar dentro do concessivo. Recua conforme os dias restantes.
   */
  limiteGozo: string;
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

  // O prazo é avaliado com o SALDO do período (dias a tirar), porque as férias
  // precisam terminar dentro do concessivo: quem tem 20 dias a gozar precisa
  // começar 19 dias antes do fim. É essa a data que o relatório do DP imprime
  // como "Limite p/ gozo", e é contra ela que se mede o atraso.
  const prazo = avaliarPrazoConcessao(new Date(periodo.dataFim), hoje, estado.diasATirar);
  const limiteGozo = new Date(prazo.limiteInicio);
  const diasParaVencer = Math.round((limiteGozo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  const temProgramacao = lancamentosResumo.some((l) => l.status === "programada");
  const situacao: SituacaoPeriodo = temProgramacao ? "programada" : prazo.vencida ? "vencida" : "a_vencer";

  const proximaDataInicio = lancamentosResumo
    .map((l) => l.data_inicio_gozo ?? l.data_inicio_prevista)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const riscoDobro = avaliarRiscoDobro(limiteGozo, proximaDataInicio ? new Date(proximaDataInicio) : null, hoje);

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
    limiteGozo: prazo.limiteInicio,
    diasParaVencer,
    vencida: prazo.vencida,
    alerta: diasParaVencer < DIAS_ALERTA_VENCIMENTO,
    situacao,
    riscoDobro,
  };
}

/**
 * Retorna TODOS os períodos aquisitivos já fechados que ainda têm saldo (dias
 * a tirar > 0), com o estado calculado e o destaque de vencimento
 * próximo/vencido/risco de dobro.
 *
 * Uma regra restringe o que conta como "em aberto": um período AINDA EM CURSO
 * (`dataFim` no futuro — os 12 meses de aquisição não se completaram) não
 * aparece aqui, mesmo que `diasDireito` já esteja com o valor cheio (30) — o
 * direito só é exigível quando o período efetivamente fecha.
 *
 * Antes havia uma segunda regra: só o período fechado MAIS RECENTE de cada
 * colaborador aparecia. Ela existia porque os períodos eram gerados
 * automaticamente pelo aniversário de admissão, e cada pessoa acumulava vários
 * períodos fantasma com 30 dias de saldo — mostrar todos inundava a tela. Com
 * os períodos vindos do relatório do DP isso se inverteu: um colaborador pode
 * legitimamente ter dois períodos com saldo, e o ANTIGO é justamente o que
 * corre risco de dobra. O Iago, por exemplo, tem 20 dias de um período cujo
 * limite para gozo venceu — era exatamente essa linha que a regra escondia,
 * e ela também não entrava na contagem de "Férias vencidas".
 */
export async function listarPeriodosAbertos(): Promise<PeriodoAquisitivoAberto[]> {
  const hoje = new Date();
  const colaboradores = await listarColaboradores();

  const db = await getDb();
  const [resultado, lancamentosPorPeriodo] = await Promise.all([
    db.execute("SELECT * FROM periodos_aquisitivos ORDER BY data_inicio"),
    buscarTodosLancamentosAtivos(),
  ]);
  const linhas = resultado.rows as unknown as LinhaPeriodo[];

  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));
  const abertos: PeriodoAquisitivoAberto[] = [];

  for (const linha of linhas) {
    const periodo = paraPeriodo(linha);
    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;

    // Ainda dentro do período aquisitivo (não fechou) — não conta como aberto/vencido ainda.
    if (new Date(periodo.dataFim) > hoje) continue;

    // Período que o DP já deu por encerrado. Necessário porque o histórico
    // ("Relação de Férias Calculadas") traz períodos antigos em que a soma dos
    // dias lançados não fecha os 30 — sem esta regra, o resto viraria saldo em
    // aberto e apareceria como "vencida" mesmo o DP não cobrando mais nada.
    // Quem manda é o relatório de programação: período que não está lá está
    // resolvido, e entra no banco com status 'concluido'.
    if (periodo.status === "concluido") continue;

    const candidato = enriquecerPeriodo(periodo, colaborador, hoje, lancamentosPorPeriodo.get(periodo.id) ?? []);
    if (candidato.diasATirar <= 0) continue;

    abertos.push(candidato);
  }

  return abertos;
}

/** Histórico completo (todos os períodos, resolvidos ou não) de um único colaborador — usado na exportação "por colaborador". */
export async function listarHistoricoColaborador(colaboradorId: number): Promise<PeriodoAquisitivoAberto[]> {
  const hoje = new Date();
  const colaborador = (await listarColaboradores()).find((c) => c.id === colaboradorId);
  if (!colaborador) return [];

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
