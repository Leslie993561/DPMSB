import "server-only";
import { getDb } from "./client";
import { buscarPeriodo, type PeriodoAquisitivo } from "./periodosAquisitivos";
import {
  calcularEstadoPeriodo,
  tetoAbono,
  validarLancamentoManual,
  validarNovoLancamentoCalculado,
  type LancamentoInfo,
} from "@/lib/ferias-gestao/validacoes";

export class ErroValidacaoFerias extends Error {}

export type StatusLancamento = "programada" | "concluida" | "cancelada" | "alterada";

export interface LancamentoFerias {
  id: number;
  periodoAquisitivoId: number;
  origem: "calculado" | "manual";
  status: StatusLancamento;
  dias: number;
  dataInicioPrevista: string | null;
  dataInicioGozo: string | null;
  dataFimGozo: string | null;
  dataRetorno: string | null;
  dataBaixa: string | null;
  abono: boolean;
  diasAbono: number;
  observacao: string | null;
  observacaoBaixa: string | null;
  anexoNome: string | null;
  criadoPor: string;
  criadoEm: string;
}

interface LinhaLancamento {
  id: number;
  periodo_aquisitivo_id: number;
  origem: "calculado" | "manual";
  status: StatusLancamento;
  dias: number;
  data_inicio_prevista: string | null;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  data_retorno: string | null;
  data_baixa: string | null;
  abono: number;
  dias_abono: number;
  observacao: string | null;
  observacao_baixa: string | null;
  anexo_nome: string | null;
  criado_por: string;
  criado_em: string;
}

function paraLancamento(linha: LinhaLancamento): LancamentoFerias {
  return {
    id: linha.id,
    periodoAquisitivoId: linha.periodo_aquisitivo_id,
    origem: linha.origem,
    status: linha.status,
    dias: linha.dias,
    dataInicioPrevista: linha.data_inicio_prevista,
    dataInicioGozo: linha.data_inicio_gozo,
    dataFimGozo: linha.data_fim_gozo,
    dataRetorno: linha.data_retorno,
    dataBaixa: linha.data_baixa,
    abono: Boolean(linha.abono),
    diasAbono: linha.dias_abono,
    observacao: linha.observacao,
    observacaoBaixa: linha.observacao_baixa,
    anexoNome: linha.anexo_nome,
    criadoPor: linha.criado_por,
    criadoEm: linha.criado_em,
  };
}

/** Histórico completo do período — inclui todos os status, nunca some nada. */
export async function listarPorPeriodo(periodoAquisitivoId: number): Promise<LancamentoFerias[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM lancamentos_ferias WHERE periodo_aquisitivo_id = ? ORDER BY criado_em",
    args: [periodoAquisitivoId],
  });
  return (resultado.rows as unknown as LinhaLancamento[]).map(paraLancamento);
}

/** Lançamentos que contam para o saldo do período — tudo exceto cancelados. */
async function listarAtivosPorPeriodo(periodoAquisitivoId: number): Promise<LancamentoFerias[]> {
  return (await listarPorPeriodo(periodoAquisitivoId)).filter((l) => l.status !== "cancelada");
}

async function buscarPeriodoOuFalhar(periodoAquisitivoId: number): Promise<PeriodoAquisitivo> {
  const periodo = await buscarPeriodo(periodoAquisitivoId);
  if (!periodo) throw new ErroValidacaoFerias("Período aquisitivo não encontrado.");
  return periodo;
}

async function buscarLancamento(id: number): Promise<LancamentoFerias | null> {
  const db = await getDb();
  const resultado = await db.execute({ sql: "SELECT * FROM lancamentos_ferias WHERE id = ?", args: [id] });
  const linha = resultado.rows[0] as unknown as LinhaLancamento | undefined;
  return linha ? paraLancamento(linha) : null;
}

async function marcarAbonoUtilizado(periodoId: number, diasAbono: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE periodos_aquisitivos SET abono_utilizado = 1, dias_abono = ? WHERE id = ?",
    args: [diasAbono, periodoId],
  });
}

/** Recalcula o saldo do período (a partir dos lançamentos ativos) e ajusta seu status. */
async function atualizarStatusPeriodo(periodoId: number): Promise<void> {
  const periodo = await buscarPeriodo(periodoId);
  if (!periodo) return;
  const ativos: LancamentoInfo[] = await listarAtivosPorPeriodo(periodoId);
  const estado = calcularEstadoPeriodo(periodo, ativos);
  const novoStatus = estado.diasATirar <= 0 ? "concluido" : "aberto";
  const db = await getDb();
  await db.execute({ sql: "UPDATE periodos_aquisitivos SET status = ? WHERE id = ?", args: [novoStatus, periodoId] });
}

async function inserirLancamento(params: {
  periodoAquisitivoId: number;
  origem: "calculado" | "manual";
  status: StatusLancamento;
  dias: number;
  dataInicioPrevista: string | null;
  dataInicioGozo: string | null;
  dataFimGozo: string | null;
  abono: boolean;
  diasAbono: number;
  observacao: string | null;
  criadoPor: string;
}): Promise<LancamentoFerias> {
  const db = await getDb();
  const info = await db.execute({
    sql: `INSERT INTO lancamentos_ferias
         (periodo_aquisitivo_id, origem, status, dias, data_inicio_prevista, data_inicio_gozo, data_fim_gozo, abono, dias_abono, observacao, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      params.periodoAquisitivoId,
      params.origem,
      params.status,
      params.dias,
      params.dataInicioPrevista,
      params.dataInicioGozo,
      params.dataFimGozo,
      params.abono ? 1 : 0,
      params.diasAbono,
      params.observacao,
      params.criadoPor,
    ],
  });

  return (await buscarLancamento(Number(info.lastInsertRowid)))!;
}

export interface CriarLancamentoCalculadoInput {
  periodoAquisitivoId: number;
  diasSolicitados: number;
  dataInicioPrevista: string;
  abonoSolicitado: boolean;
  operador: string;
}

/**
 * Programa uma solicitação de férias (fluxo normal do modal de cálculo), com
 * todas as validações de fracionamento/abono. Nasce com status "programada"
 * — só vira "concluída" quando a baixa for confirmada.
 */
export async function criarLancamentoCalculado(input: CriarLancamentoCalculadoInput): Promise<LancamentoFerias> {
  const periodo = await buscarPeriodoOuFalhar(input.periodoAquisitivoId);
  const ativos = await listarAtivosPorPeriodo(periodo.id);
  const estado = calcularEstadoPeriodo(periodo, ativos);

  const resultado = validarNovoLancamentoCalculado(
    periodo,
    estado,
    input.diasSolicitados,
    input.abonoSolicitado,
  );
  if (!resultado.ok) throw new ErroValidacaoFerias(resultado.erro);

  const diasAbono = input.abonoSolicitado ? tetoAbono(periodo.diasDireito) : 0;
  const lancamento = await inserirLancamento({
    periodoAquisitivoId: periodo.id,
    origem: "calculado",
    status: "programada",
    dias: input.diasSolicitados,
    dataInicioPrevista: input.dataInicioPrevista,
    dataInicioGozo: null,
    dataFimGozo: null,
    abono: input.abonoSolicitado,
    diasAbono,
    observacao: null,
    criadoPor: input.operador,
  });

  if (input.abonoSolicitado) await marcarAbonoUtilizado(periodo.id, diasAbono);
  await atualizarStatusPeriodo(periodo.id);
  return lancamento;
}

export interface CriarLancamentoManualInput {
  periodoAquisitivoId: number;
  diasGozados: number;
  dataInicioGozo: string;
  dataFimGozo: string;
  abono: boolean;
  diasVendidos: number;
  observacao: string | null;
  operador: string;
}

/**
 * Registra um lançamento histórico/manual (período já usufruído antes do
 * sistema) — nasce direto como "concluída", sem passar por programação/baixa.
 */
export async function criarLancamentoManual(input: CriarLancamentoManualInput): Promise<LancamentoFerias> {
  const periodo = await buscarPeriodoOuFalhar(input.periodoAquisitivoId);
  const ativos = await listarAtivosPorPeriodo(periodo.id);
  const estado = calcularEstadoPeriodo(periodo, ativos);

  const resultado = validarLancamentoManual(
    periodo,
    estado,
    input.diasGozados,
    input.abono,
    input.diasVendidos,
  );
  if (!resultado.ok) throw new ErroValidacaoFerias(resultado.erro);

  const lancamento = await inserirLancamento({
    periodoAquisitivoId: periodo.id,
    origem: "manual",
    status: "concluida",
    dias: input.diasGozados,
    dataInicioPrevista: null,
    dataInicioGozo: input.dataInicioGozo,
    dataFimGozo: input.dataFimGozo,
    abono: input.abono,
    diasAbono: input.abono ? input.diasVendidos : 0,
    observacao: input.observacao,
    criadoPor: input.operador,
  });

  if (input.abono) await marcarAbonoUtilizado(periodo.id, input.diasVendidos);
  await atualizarStatusPeriodo(periodo.id);
  return lancamento;
}

export interface DarBaixaInput {
  dataInicioReal: string;
  dataFimReal: string;
  dataRetorno: string;
  diasGozadosReal: number;
  observacaoBaixa: string | null;
  anexoNome: string | null;
  operador: string;
}

/**
 * Confirma (dá baixa em) uma férias programada, com os dados reais de
 * gozo — só deve ser chamada quando o usuário confirma que as férias foram
 * efetivamente concedidas (ou anexa a documentação correspondente). Vira
 * "concluída" se os dados batem com a programação original, ou "alterada" se
 * a quantidade de dias efetivamente gozados for diferente.
 */
export async function darBaixa(lancamentoId: number, input: DarBaixaInput): Promise<LancamentoFerias> {
  const lancamento = await buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "programada") {
    throw new ErroValidacaoFerias("Só é possível dar baixa em férias com status Programada.");
  }
  if (input.diasGozadosReal <= 0) {
    throw new ErroValidacaoFerias("Informe uma quantidade de dias gozados maior que zero.");
  }

  const periodo = await buscarPeriodoOuFalhar(lancamento.periodoAquisitivoId);
  const outrosAtivos = (await listarAtivosPorPeriodo(periodo.id)).filter((l) => l.id !== lancamentoId);
  const estadoSemEste = calcularEstadoPeriodo(periodo, outrosAtivos);

  if (estadoSemEste.diasTirados + input.diasGozadosReal > estadoSemEste.diasDireitoEfetivo) {
    throw new ErroValidacaoFerias(
      `A baixa com ${input.diasGozadosReal} dia(s) excede os dias de direito do período aquisitivo.`,
    );
  }

  const status: StatusLancamento = input.diasGozadosReal === lancamento.dias ? "concluida" : "alterada";

  const db = await getDb();
  await db.execute({
    sql: `UPDATE lancamentos_ferias
       SET status = ?, dias = ?, data_inicio_gozo = ?, data_fim_gozo = ?, data_retorno = ?,
           data_baixa = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), observacao_baixa = ?, anexo_nome = ?, criado_por = ?
       WHERE id = ?`,
    args: [
      status,
      input.diasGozadosReal,
      input.dataInicioReal,
      input.dataFimReal,
      input.dataRetorno,
      input.observacaoBaixa,
      input.anexoNome,
      input.operador,
      lancamentoId,
    ],
  });

  await atualizarStatusPeriodo(periodo.id);
  return (await buscarLancamento(lancamentoId))!;
}

export interface ReverterBaixaInput {
  operador: string;
}

/**
 * Desfaz uma baixa já confirmada — volta o lançamento para "programada" (some
 * do total gozado no Controle de Férias, mas continua reservado no
 * Planejamento) e limpa os dados de gozo real, mantendo a data prevista
 * original para reabrir "Confirmar gozo".
 */
export async function reverterBaixa(lancamentoId: number, input: ReverterBaixaInput): Promise<LancamentoFerias> {
  const lancamento = await buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "concluida" && lancamento.status !== "alterada") {
    throw new ErroValidacaoFerias("Só é possível desfazer a baixa de férias já confirmadas.");
  }

  // Lançamentos que nasceram já "concluída" (import histórico do Controle de
  // Férias) nunca tiveram data prevista — sem isso, o Planejamento perderia a
  // data ao reabrir. Nesse caso, a própria data de gozo (que estamos limpando)
  // vira a nova data prevista.
  const dataInicioPrevista = lancamento.dataInicioPrevista ?? lancamento.dataInicioGozo;

  const db = await getDb();
  await db.execute({
    sql: `UPDATE lancamentos_ferias
       SET status = 'programada', data_inicio_prevista = ?, data_inicio_gozo = NULL, data_fim_gozo = NULL,
           data_retorno = NULL, data_baixa = NULL, observacao_baixa = NULL, anexo_nome = NULL, criado_por = ?
       WHERE id = ?`,
    args: [dataInicioPrevista, input.operador, lancamentoId],
  });

  await atualizarStatusPeriodo(lancamento.periodoAquisitivoId);
  return (await buscarLancamento(lancamentoId))!;
}

export interface CancelarLancamentoInput {
  motivo: string;
  operador: string;
}

/**
 * Cancela uma programação de férias (devolve o saldo ao período aquisitivo).
 * Só se aplica a lançamentos ainda "programada" — algo já concluído é fato
 * consumado e não deve ser cancelado por aqui.
 */
export async function cancelarLancamento(lancamentoId: number, input: CancelarLancamentoInput): Promise<LancamentoFerias> {
  const lancamento = await buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "programada") {
    throw new ErroValidacaoFerias("Só é possível cancelar férias com status Programada.");
  }

  const db = await getDb();
  await db.execute({
    sql: `UPDATE lancamentos_ferias
       SET status = 'cancelada', data_baixa = to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), observacao_baixa = ?, criado_por = ?
       WHERE id = ?`,
    args: [`Cancelado: ${input.motivo}`, input.operador, lancamentoId],
  });

  await atualizarStatusPeriodo(lancamento.periodoAquisitivoId);
  return (await buscarLancamento(lancamentoId))!;
}

export interface LancamentoComContexto {
  lancamento: LancamentoFerias;
  colaboradorNome: string;
  colaboradorDepartamento: string | null;
}

/**
 * Lançamentos ativos (não cancelados) com o nome/departamento do colaborador
 * — usado pelos Alertas Inteligentes (programações pendentes de baixa e
 * conflitos de agenda por setor). Evita N+1 fazendo o join em uma query só.
 */
export async function listarLancamentosAtivosComContexto(): Promise<LancamentoComContexto[]> {
  const db = await getDb();
  const resultado = await db.execute(
    `SELECT l.*, c.nome AS colaborador_nome, c.departamento AS colaborador_departamento
       FROM lancamentos_ferias l
       JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
       JOIN colaboradores c ON c.id = p.colaborador_id
       WHERE l.status != 'cancelada'
       ORDER BY l.data_inicio_prevista, l.data_inicio_gozo`,
  );
  const linhas = resultado.rows as unknown as (LinhaLancamento & {
    colaborador_nome: string;
    colaborador_departamento: string | null;
  })[];

  return linhas.map((linha) => ({
    lancamento: paraLancamento(linha),
    colaboradorNome: linha.colaborador_nome,
    colaboradorDepartamento: linha.colaborador_departamento,
  }));
}
