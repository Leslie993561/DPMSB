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
export function listarPorPeriodo(periodoAquisitivoId: number): LancamentoFerias[] {
  const linhas = getDb()
    .prepare("SELECT * FROM lancamentos_ferias WHERE periodo_aquisitivo_id = ? ORDER BY criado_em")
    .all(periodoAquisitivoId) as unknown as LinhaLancamento[];
  return linhas.map(paraLancamento);
}

/** Lançamentos que contam para o saldo do período — tudo exceto cancelados. */
function listarAtivosPorPeriodo(periodoAquisitivoId: number): LancamentoFerias[] {
  return listarPorPeriodo(periodoAquisitivoId).filter((l) => l.status !== "cancelada");
}

function buscarPeriodoOuFalhar(periodoAquisitivoId: number): PeriodoAquisitivo {
  const periodo = buscarPeriodo(periodoAquisitivoId);
  if (!periodo) throw new ErroValidacaoFerias("Período aquisitivo não encontrado.");
  return periodo;
}

function buscarLancamento(id: number): LancamentoFerias | null {
  const linha = getDb().prepare("SELECT * FROM lancamentos_ferias WHERE id = ?").get(id) as
    | LinhaLancamento
    | undefined;
  return linha ? paraLancamento(linha) : null;
}

function marcarAbonoUtilizado(periodoId: number, diasAbono: number): void {
  getDb()
    .prepare("UPDATE periodos_aquisitivos SET abono_utilizado = 1, dias_abono = ? WHERE id = ?")
    .run(diasAbono, periodoId);
}

/** Recalcula o saldo do período (a partir dos lançamentos ativos) e ajusta seu status. */
function atualizarStatusPeriodo(periodoId: number): void {
  const periodo = buscarPeriodo(periodoId);
  if (!periodo) return;
  const ativos: LancamentoInfo[] = listarAtivosPorPeriodo(periodoId);
  const estado = calcularEstadoPeriodo(periodo, ativos);
  const novoStatus = estado.diasATirar <= 0 ? "concluido" : "aberto";
  getDb().prepare("UPDATE periodos_aquisitivos SET status = ? WHERE id = ?").run(novoStatus, periodoId);
}

function inserirLancamento(params: {
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
}): LancamentoFerias {
  const info = getDb()
    .prepare(
      `INSERT INTO lancamentos_ferias
         (periodo_aquisitivo_id, origem, status, dias, data_inicio_prevista, data_inicio_gozo, data_fim_gozo, abono, dias_abono, observacao, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
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
    );

  return buscarLancamento(Number(info.lastInsertRowid))!;
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
export function criarLancamentoCalculado(input: CriarLancamentoCalculadoInput): LancamentoFerias {
  const periodo = buscarPeriodoOuFalhar(input.periodoAquisitivoId);
  const ativos = listarAtivosPorPeriodo(periodo.id);
  const estado = calcularEstadoPeriodo(periodo, ativos);

  const resultado = validarNovoLancamentoCalculado(
    periodo,
    estado,
    input.diasSolicitados,
    input.abonoSolicitado,
  );
  if (!resultado.ok) throw new ErroValidacaoFerias(resultado.erro);

  const diasAbono = input.abonoSolicitado ? tetoAbono(periodo.diasDireito) : 0;
  const lancamento = inserirLancamento({
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

  if (input.abonoSolicitado) marcarAbonoUtilizado(periodo.id, diasAbono);
  atualizarStatusPeriodo(periodo.id);
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
export function criarLancamentoManual(input: CriarLancamentoManualInput): LancamentoFerias {
  const periodo = buscarPeriodoOuFalhar(input.periodoAquisitivoId);
  const ativos = listarAtivosPorPeriodo(periodo.id);
  const estado = calcularEstadoPeriodo(periodo, ativos);

  const resultado = validarLancamentoManual(
    periodo,
    estado,
    input.diasGozados,
    input.abono,
    input.diasVendidos,
  );
  if (!resultado.ok) throw new ErroValidacaoFerias(resultado.erro);

  const lancamento = inserirLancamento({
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

  if (input.abono) marcarAbonoUtilizado(periodo.id, input.diasVendidos);
  atualizarStatusPeriodo(periodo.id);
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
export function darBaixa(lancamentoId: number, input: DarBaixaInput): LancamentoFerias {
  const lancamento = buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "programada") {
    throw new ErroValidacaoFerias("Só é possível dar baixa em férias com status Programada.");
  }
  if (input.diasGozadosReal <= 0) {
    throw new ErroValidacaoFerias("Informe uma quantidade de dias gozados maior que zero.");
  }

  const periodo = buscarPeriodoOuFalhar(lancamento.periodoAquisitivoId);
  const outrosAtivos = listarAtivosPorPeriodo(periodo.id).filter((l) => l.id !== lancamentoId);
  const estadoSemEste = calcularEstadoPeriodo(periodo, outrosAtivos);

  if (estadoSemEste.diasTirados + input.diasGozadosReal > estadoSemEste.diasDireitoEfetivo) {
    throw new ErroValidacaoFerias(
      `A baixa com ${input.diasGozadosReal} dia(s) excede os dias de direito do período aquisitivo.`,
    );
  }

  const status: StatusLancamento = input.diasGozadosReal === lancamento.dias ? "concluida" : "alterada";

  getDb()
    .prepare(
      `UPDATE lancamentos_ferias
       SET status = ?, dias = ?, data_inicio_gozo = ?, data_fim_gozo = ?, data_retorno = ?,
           data_baixa = datetime('now'), observacao_baixa = ?, anexo_nome = ?, criado_por = ?
       WHERE id = ?`,
    )
    .run(
      status,
      input.diasGozadosReal,
      input.dataInicioReal,
      input.dataFimReal,
      input.dataRetorno,
      input.observacaoBaixa,
      input.anexoNome,
      input.operador,
      lancamentoId,
    );

  atualizarStatusPeriodo(periodo.id);
  return buscarLancamento(lancamentoId)!;
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
export function reverterBaixa(lancamentoId: number, input: ReverterBaixaInput): LancamentoFerias {
  const lancamento = buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "concluida" && lancamento.status !== "alterada") {
    throw new ErroValidacaoFerias("Só é possível desfazer a baixa de férias já confirmadas.");
  }

  // Lançamentos que nasceram já "concluída" (import histórico do Controle de
  // Férias) nunca tiveram data prevista — sem isso, o Planejamento perderia a
  // data ao reabrir. Nesse caso, a própria data de gozo (que estamos limpando)
  // vira a nova data prevista.
  const dataInicioPrevista = lancamento.dataInicioPrevista ?? lancamento.dataInicioGozo;

  getDb()
    .prepare(
      `UPDATE lancamentos_ferias
       SET status = 'programada', data_inicio_prevista = ?, data_inicio_gozo = NULL, data_fim_gozo = NULL,
           data_retorno = NULL, data_baixa = NULL, observacao_baixa = NULL, anexo_nome = NULL, criado_por = ?
       WHERE id = ?`,
    )
    .run(dataInicioPrevista, input.operador, lancamentoId);

  atualizarStatusPeriodo(lancamento.periodoAquisitivoId);
  return buscarLancamento(lancamentoId)!;
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
export function cancelarLancamento(lancamentoId: number, input: CancelarLancamentoInput): LancamentoFerias {
  const lancamento = buscarLancamento(lancamentoId);
  if (!lancamento) throw new ErroValidacaoFerias("Lançamento não encontrado.");
  if (lancamento.status !== "programada") {
    throw new ErroValidacaoFerias("Só é possível cancelar férias com status Programada.");
  }

  getDb()
    .prepare(
      `UPDATE lancamentos_ferias
       SET status = 'cancelada', data_baixa = datetime('now'), observacao_baixa = ?, criado_por = ?
       WHERE id = ?`,
    )
    .run(`Cancelado: ${input.motivo}`, input.operador, lancamentoId);

  atualizarStatusPeriodo(lancamento.periodoAquisitivoId);
  return buscarLancamento(lancamentoId)!;
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
export function listarLancamentosAtivosComContexto(): LancamentoComContexto[] {
  const linhas = getDb()
    .prepare(
      `SELECT l.*, c.nome AS colaborador_nome, c.departamento AS colaborador_departamento
       FROM lancamentos_ferias l
       JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
       JOIN colaboradores c ON c.id = p.colaborador_id
       WHERE l.status != 'cancelada'
       ORDER BY l.data_inicio_prevista, l.data_inicio_gozo`,
    )
    .all() as unknown as (LinhaLancamento & {
    colaborador_nome: string;
    colaborador_departamento: string | null;
  })[];

  return linhas.map((linha) => ({
    lancamento: paraLancamento(linha),
    colaboradorNome: linha.colaborador_nome,
    colaboradorDepartamento: linha.colaborador_departamento,
  }));
}
