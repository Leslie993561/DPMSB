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

export type SituacaoPeriodo = "vencida" | "a_vencer" | "programada" | "concluido";

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

  // Gozado por inteiro vem primeiro: é o resultado do "Confirmar gozo" e não
  // faz sentido chamar de vencido ou a vencer algo que já foi todo tirado.
  const temProgramacao = lancamentosResumo.some((l) => l.status === "programada");
  const situacao: SituacaoPeriodo = estado.diasATirar <= 0
    ? "concluido"
    : temProgramacao
      ? "programada"
      : prazo.vencida
        ? "vencida"
        : "a_vencer";

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
    // "Vencido" é limite p/ gozo no passado COM dias restantes — é a definição
    // impressa no rodapé da tela. Período já gozado por inteiro não vence nem
    // alerta: não há mais o que conceder, então ele não entra nos contadores de
    // risco só porque a data passou.
    vencida: estado.diasATirar > 0 && prazo.vencida,
    alerta: estado.diasATirar > 0 && diasParaVencer < DIAS_ALERTA_VENCIMENTO,
    situacao,
    riscoDobro: estado.diasATirar > 0 && riscoDobro,
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
/**
 * Um único carregamento do que o Controle de Férias precisa. Existe porque
 * `listarPeriodosAbertos` e `listarPeriodosEmCurso` liam exatamente as mesmas
 * três coisas: chamar as duas dobrava as idas ao banco e, com o pooler do
 * Supabase limitado a 15 conexões, isso derrubava a página inteira.
 */
async function carregarBase() {
  const colaboradores = await listarColaboradores();
  const db = await getDb();
  const [resultado, lancamentosPorPeriodo] = await Promise.all([
    db.execute("SELECT * FROM periodos_aquisitivos ORDER BY data_inicio"),
    buscarTodosLancamentosAtivos(),
  ]);
  return {
    colaboradores,
    periodos: (resultado.rows as unknown as LinhaPeriodo[]).map(paraPeriodo),
    lancamentosPorPeriodo,
  };
}

type BaseControle = Awaited<ReturnType<typeof carregarBase>>;

export async function listarPeriodosAbertos(base?: BaseControle): Promise<PeriodoAquisitivoAberto[]> {
  const hoje = new Date();
  const { colaboradores, periodos, lancamentosPorPeriodo } = base ?? (await carregarBase());

  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));
  const abertos: PeriodoAquisitivoAberto[] = [];

  for (const periodo of periodos) {
    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;

    // Ainda dentro do período aquisitivo (não fechou) — não conta como aberto/vencido ainda.
    if (new Date(periodo.dataFim) > hoje) continue;

    const candidato = enriquecerPeriodo(periodo, colaborador, hoje, lancamentosPorPeriodo.get(periodo.id) ?? []);

    // Período com os 30 dias efetivamente gozados FICA na tela, como
    // "Concluído". É por aqui que o "Confirmar gozo" do Planejamento aparece no
    // Controle: os dias entram na coluna GOZ em vez de a linha sumir, que era o
    // que acontecia antes e dava a impressão de que a baixa não tinha valido.
    if (candidato.diasTirados >= candidato.diasDireito) {
      abertos.push(candidato);
      continue;
    }

    // Período que o DP já deu por encerrado SEM os dias fecharem. Vem do
    // histórico ("Relação de Férias Calculadas"), que traz períodos antigos em
    // que a soma dos lançamentos não chega aos 30 — sem esta regra o resto
    // viraria saldo em aberto e apareceria como "vencida" mesmo o DP não
    // cobrando mais nada. São 22 registros hoje, e continuam fora da tela.
    // A exceção: se ainda existe uma programação em aberto no período, ele NÃO
    // é sobra — está vivo. É o caso de quem teve a baixa desfeita: os dias
    // voltam a ser programados e o período continua marcado como 'concluido'
    // no banco (o status conta dias ALOCADOS, não gozados). Sem esta ressalva a
    // linha desaparecia da tela logo depois de retornar as férias ao
    // planejamento, e o saldo ficava invisível.
    if (periodo.status === "concluido" && candidato.situacao !== "programada") continue;

    // Sem saldo e sem gozo registrado: não há o que mostrar nem o que conciliar.
    if (candidato.diasATirar <= 0) continue;

    abertos.push(candidato);
  }

  // Período fechado só continua na tela quando é a ÚNICA linha da pessoa.
  //
  // Os 30 dias gozados ficam visíveis como "Concluído" para que "Confirmar
  // gozo" não faça a linha desaparecer — foi por isso que essa regra existe.
  // Mas quando o colaborador já tem um período com saldo, a linha fechada não
  // acrescenta nada e o nome aparece duas vezes seguidas, que se lê como
  // duplicata: a Carolina tinha 2023–2024 fechado logo acima de 2024–2025 com
  // 15 dias a tirar. O histórico completo continua na exportação por
  // colaborador e no drawer da pessoa.
  const temSaldo = new Set(abertos.filter((p) => p.diasATirar > 0).map((p) => p.colaboradorId));

  // Sem saldo em nenhum período, sobra o período fechado MAIS RECENTE. Uma
  // linha já cumpre o papel de não deixar a pessoa desaparecer da tela; duas
  // ou três só repetem o nome. A Leildes tinha dois períodos 30/30 seguidos.
  const fechadoMaisRecente = new Map<number, string>();
  for (const p of abertos) {
    if (p.diasATirar > 0 || temSaldo.has(p.colaboradorId)) continue;
    const atual = fechadoMaisRecente.get(p.colaboradorId);
    if (!atual || p.dataInicio > atual) fechadoMaisRecente.set(p.colaboradorId, p.dataInicio);
  }

  return abertos.filter((p) => {
    if (p.diasATirar > 0) return true;
    if (temSaldo.has(p.colaboradorId)) return false;
    return fechadoMaisRecente.get(p.colaboradorId) === p.dataInicio;
  });
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

/**
 * Período aquisitivo AINDA EM CURSO — usado nas linhas "Em dia" do Controle de
 * Férias, para que elas mostrem aquisitivo, concessivo e limite p/ gozo em vez
 * de traços. Não é um período "em aberto": o direito ainda não é exigível,
 * e por isso ele não entra em `listarPeriodosAbertos()` nem nos alertas.
 */
export interface JanelaEmCurso {
  aquisitivoInicio: string;
  aquisitivoFim: string;
  concessivoInicio: string;
  concessivoFim: string;
  limiteGozo: string;
  diasDireito: number;
  diasTirados: number;
  diasATirar: number;
  /** Dias já acumulados: 1/12 do direito por mês completo trabalhado, sem descontar faltas. */
  diasAcumulados: number;
  /**
   * true = o período foi calculado a partir da data de admissão porque o
   * colaborador ainda não apareceu em nenhum relatório do DP. Vale menos que um
   * período importado (afastamento e licença deslocam a aquisição), então a
   * tela marca a diferença em vez de fingir que as duas origens são iguais.
   */
  derivado: boolean;
}

export interface PeriodoEmCurso {
  colaboradorId: number;
  colaboradorNome: string;
  colaboradorCargo: string | null;
  colaboradorDepartamento: string | null;
  colaboradorCpf: string | null;
  colaboradorAdmissao: string;
  /**
   * null quando não há período do DP para a pessoa e ela também não está na
   * lista de projeção pela admissão — a linha fica com as colunas vazias, que
   * é o certo: melhor não mostrar nada do que mostrar um período que o DP não
   * reconhece.
   */
  janela: JanelaEmCurso | null;
}

/** Compara nomes ignorando acento, caixa e espaço sobrando (o cadastro tem nome com espaço à frente). */
function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/s+/g, " ")
    .trim();
}

/**
 * Quem NÃO tem período no relatório do DP mas mesmo assim deve ter o
 * aquisitivo projetado pela data de admissão. Lista fechada, definida pelo DP:
 * para os demais a projeção não corresponde ao que é controlado, então a linha
 * fica sem período até a pessoa aparecer em um relatório.
 */
const PROJETAR_PELA_ADMISSAO = new Set(
  [
    "ELIVA DA NATIVIDADE MENESES",
    "CRISTIANE ANDRADE",
    "LAISA ROCHA FERREIRA MACHADO DOS SANTOS",
    "MARIA EDUARDA BRANDAO SOARES",
    "TASSIO ANTONIO LIMA SANT ANA",
    "THIAGO ALVES DIAS",
    "YURI IVONEI CRISPIM",
  ].map(normalizarNome),
);

function somarMeses(data: string, meses: number): Date {
  const d = new Date(data);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/** Período aquisitivo vigente contado da admissão, em blocos de 12 meses. */
function derivarPeriodoEmCurso(dataAdmissao: string, hoje: Date): { inicio: string; fim: string } {
  let inicio = new Date(dataAdmissao);
  // Limite de segurança: 60 voltas cobre 60 anos de casa e evita laço infinito
  // se a data de admissão vier inválida do cadastro.
  for (let i = 0; i < 60; i++) {
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + 12);
    fim.setDate(fim.getDate() - 1);
    if (fim > hoje) return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
    inicio = somarMeses(inicio.toISOString().slice(0, 10), 12);
  }
  const fim = somarMeses(inicio.toISOString().slice(0, 10), 12);
  fim.setDate(fim.getDate() - 1);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/** Meses completos entre duas datas — a fração de 1/12 que o período já acumulou. */
function mesesCompletos(inicio: string, hoje: Date): number {
  const i = new Date(inicio);
  if (hoje <= i) return 0;
  let meses = (hoje.getFullYear() - i.getFullYear()) * 12 + (hoje.getMonth() - i.getMonth());
  if (hoje.getDate() < i.getDate()) meses--;
  return Math.max(0, Math.min(12, meses));
}

/**
 * Um registro por colaborador ativo que NÃO tem período em aberto — quem
 * aparece como "Em dia" na tabela. Usa o período em curso importado do
 * relatório do DP quando ele existe; só cai para o cálculo pela admissão
 * quando a pessoa ainda não apareceu em relatório nenhum.
 */
export async function listarPeriodosEmCurso(base?: BaseControle): Promise<PeriodoEmCurso[]> {
  const hoje = new Date();
  const dados = base ?? (await carregarBase());
  const { colaboradores, periodos: linhas, lancamentosPorPeriodo } = dados;
  // Só conta quem tem período com SALDO. Um período apenas "Concluído" não
  // dispensa a linha do período seguinte: depois de gozar os 30 dias, o que
  // interessa ver é justamente o que está sendo adquirido agora.
  const comPeriodoAberto = new Set(
    (await listarPeriodosAbertos(dados)).filter((p) => p.situacao !== "concluido").map((p) => p.colaboradorId),
  );

  const emCurso: PeriodoEmCurso[] = [];

  for (const colaborador of colaboradores) {
    if (colaborador.status === "desligado") continue;
    if (comPeriodoAberto.has(colaborador.id)) continue;

    // O PRIMEIRO que ainda não fechou — é o que está sendo adquirido agora.
    // Pegar o mais recente daria o período seguinte, que nem começou: a Alice
    // tem 2025-09-15..2026-09-14 correndo e 2026-09-15..2027-09-14 na fila, e
    // o relatório do DP mostra o primeiro.
    const doDp = linhas
      .filter((p) => p.colaboradorId === colaborador.id && new Date(p.dataFim) > hoje)
      .sort((a, z) => a.dataInicio.localeCompare(z.dataInicio))[0];

    const identificacao = {
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      colaboradorCargo: colaborador.cargo,
      colaboradorDepartamento: colaborador.departamento,
      colaboradorCpf: colaborador.cpf,
      colaboradorAdmissao: colaborador.dataAdmissao,
    };

    // Sem período do DP e fora da lista de projeção: a pessoa continua na
    // tabela, mas sem datas. É a linha que o DP ainda não tem como respaldar.
    if (!doDp && !PROJETAR_PELA_ADMISSAO.has(normalizarNome(colaborador.nome))) {
      emCurso.push({ ...identificacao, janela: null });
      continue;
    }

    const derivado = !doDp;
    const periodo = doDp
      ? { inicio: doDp.dataInicio, fim: doDp.dataFim }
      : derivarPeriodoEmCurso(colaborador.dataAdmissao, hoje);

    const diasDireito = doDp?.diasDireito ?? 30;
    const confirmados = (doDp ? (lancamentosPorPeriodo.get(doDp.id) ?? []) : []).filter(
      (l) => l.status === "concluida" || l.status === "alterada",
    );
    const diasTirados = confirmados.reduce((s, l) => s + l.dias, 0);
    const diasATirar = Math.max(0, diasDireito - diasTirados);

    // O limite p/ gozo do relatório: recua conforme os dias que ainda faltam gozar.
    const prazo = avaliarPrazoConcessao(new Date(periodo.fim), hoje, diasATirar);

    emCurso.push({
      ...identificacao,
      janela: {
        aquisitivoInicio: periodo.inicio,
        aquisitivoFim: periodo.fim,
        concessivoInicio: periodo.fim,
        concessivoFim: prazo.limiteConcessao,
        limiteGozo: prazo.limiteInicio,
        diasDireito,
        diasTirados,
        diasATirar,
        diasAcumulados: Math.round((mesesCompletos(periodo.inicio, hoje) / 12) * diasDireito * 10) / 10,
        derivado,
      },
    });
  }

  return emCurso;
}

/** As duas listas do Controle de Férias com um único carregamento do banco. */
export async function listarControleDeFerias(): Promise<{
  periodos: PeriodoAquisitivoAberto[];
  emCurso: PeriodoEmCurso[];
}> {
  const base = await carregarBase();
  const periodos = await listarPeriodosAbertos(base);
  const emCurso = await listarPeriodosEmCurso(base);
  return { periodos, emCurso };
}
