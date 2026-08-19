import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";

export interface LinhaProgramacaoAnual {
  codigo: string | null;
  nomeColaborador: string;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  inicioFerias: string;
  diasFerias: number;
  abono: boolean;
  diasAbono: number;
  observacoes: string | null;
}

export interface ResultadoProgramacaoAnual {
  lancados: number;
  periodosCriados: number;
  descartados: { linha: number; motivo: string }[];
}

const DIAS_DIREITO_PADRAO = 30;

function marcadorImportacao(nomeArquivo: string): string {
  return `[importado:${nomeArquivo}]`;
}

/**
 * Lança a programação anual de férias (planilha "18 colunas" do assistente
 * de Planejamento) — diferente de `importarProgramacaoFerias` (Controle),
 * que registra o que JÁ ACONTECEU (status concluída): aqui cada linha vira
 * uma programação FUTURA (status "programada"), que só passa a "baixada"
 * quando o DP confirmar o gozo depois, pela ação "Confirmar gozo".
 *
 * Colunas de contexto do colaborador na planilha (centro de custo, cargo,
 * gestor, salário, admissão, concessivo, trimestre) servem só para
 * identificar/conferir a linha — nunca escrevem no cadastro do colaborador,
 * que é gerido pelo módulo de Colaboradores.
 */
export async function importarProgramacaoAnual(
  itens: LinhaProgramacaoAnual[],
  nomeArquivo: string,
): Promise<ResultadoProgramacaoAnual> {
  const db = await getDb();
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));
  const marcador = marcadorImportacao(nomeArquivo);

  let lancados = 0;
  let periodosCriados = 0;
  const descartados: ResultadoProgramacaoAnual["descartados"] = [];

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2;
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeColaborador.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.` });
      continue;
    }
    if (!item.aquisitivoInicio || !item.aquisitivoFim || !item.inicioFerias) {
      descartados.push({ linha, motivo: `Datas obrigatórias ausentes para "${item.nomeColaborador}".` });
      continue;
    }
    if (item.diasFerias <= 0) {
      descartados.push({ linha, motivo: `"Dias de férias" precisa ser maior que zero para "${item.nomeColaborador}".` });
      continue;
    }

    const periodoResultado = await db.execute({
      sql: "SELECT id FROM periodos_aquisitivos WHERE colaborador_id = ? AND data_inicio = ?",
      args: [colaborador.id, item.aquisitivoInicio],
    });
    let periodo = periodoResultado.rows[0] as unknown as { id: number } | undefined;

    if (!periodo) {
      const info = await db.execute({
        sql: `INSERT INTO periodos_aquisitivos (colaborador_id, data_inicio, data_fim, dias_direito)
           VALUES (?, ?, ?, ?)`,
        args: [colaborador.id, item.aquisitivoInicio, item.aquisitivoFim, DIAS_DIREITO_PADRAO],
      });
      periodo = { id: Number(info.lastInsertRowid) };
      periodosCriados++;
    }

    // Idempotente: reimportar o mesmo arquivo substitui a programação que ELE criou, não duplica.
    // O marcador fica no fim de `observacao` (que pode ter a observação do usuário na frente), daí o LIKE.
    await db.execute({
      sql: "DELETE FROM lancamentos_ferias WHERE periodo_aquisitivo_id = ? AND observacao LIKE ?",
      args: [periodo.id, `%${marcador}`],
    });

    const observacao = item.observacoes ? `${item.observacoes} ${marcador}` : marcador;
    await db.execute({
      sql: `INSERT INTO lancamentos_ferias
         (periodo_aquisitivo_id, origem, status, dias, data_inicio_prevista, abono, dias_abono, observacao, criado_por)
       VALUES (?, 'calculado', 'programada', ?, ?, ?, ?, ?, 'Importação de arquivo')`,
      args: [periodo.id, item.diasFerias, item.inicioFerias, item.abono ? 1 : 0, item.diasAbono, observacao],
    });
    lancados++;
  }

  return { lancados, periodosCriados, descartados };
}
