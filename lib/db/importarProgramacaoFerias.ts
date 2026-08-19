import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";

export interface LinhaImportacaoFerias {
  codigo: string | null;
  nomeEmpregado: string;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  diasDireito: number;
  diasGozados: number;
  abono: boolean;
}

export interface ResultadoImportacaoFerias {
  atualizados: number;
  criados: number;
  descartados: { linha: number; motivo: string }[];
}

function marcadorImportacao(nomeArquivo: string): string {
  return `[importado:${nomeArquivo}]`;
}

/**
 * Aplica uma programação de férias (lida de XLSX/PDF do DP) ao Controle.
 *
 * Casamento do colaborador: por `codigo` (id) quando informado, senão por nome
 * (exato, sem diferenciar maiúsculas). Linhas sem colaborador correspondente
 * são descartadas e reportadas — nunca criamos um colaborador a partir de uma
 * importação de férias.
 *
 * Um período aquisitivo já existente (mesmo colaborador + mesma data de
 * início) é atualizado; senão, um novo é inserido diretamente com os valores
 * do arquivo (sem passar pelo ciclo automático de 12 meses).
 *
 * "Dias gozados" nunca é um campo solto na tabela — é sempre derivado dos
 * lançamentos daquele período. Para refletir o valor do arquivo, o lançamento
 * "desta importação" (identificado por uma marca em `observacao`) é apagado
 * e recriado a cada rodada — reimportar o mesmo arquivo substitui sua própria
 * contribuição em vez de duplicar; lançamentos feitos manualmente no sistema
 * (sem essa marca) nunca são tocados.
 */
export async function importarProgramacaoFerias(
  itens: LinhaImportacaoFerias[],
  nomeArquivo: string,
): Promise<ResultadoImportacaoFerias> {
  const db = await getDb();
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));
  const marcador = marcadorImportacao(nomeArquivo);

  let atualizados = 0;
  let criados = 0;
  const descartados: ResultadoImportacaoFerias["descartados"] = [];

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2; // +1 pelo cabeçalho, +1 por índice base 1
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeEmpregado.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeEmpregado}" não encontrado no cadastro.` });
      continue;
    }
    if (!item.aquisitivoInicio || !item.aquisitivoFim) {
      descartados.push({ linha, motivo: `Período aquisitivo incompleto para "${item.nomeEmpregado}".` });
      continue;
    }

    const existenteResultado = await db.execute({
      sql: "SELECT id FROM periodos_aquisitivos WHERE colaborador_id = ? AND data_inicio = ?",
      args: [colaborador.id, item.aquisitivoInicio],
    });
    const existente = existenteResultado.rows[0] as unknown as { id: number } | undefined;

    let periodoId: number;
    if (existente) {
      await db.execute({
        sql: "UPDATE periodos_aquisitivos SET data_fim = ?, dias_direito = ?, abono_utilizado = ? WHERE id = ?",
        args: [item.aquisitivoFim, item.diasDireito, item.abono ? 1 : 0, existente.id],
      });
      periodoId = existente.id;
      atualizados++;
    } else {
      const info = await db.execute({
        sql: `INSERT INTO periodos_aquisitivos (colaborador_id, data_inicio, data_fim, dias_direito, abono_utilizado)
           VALUES (?, ?, ?, ?, ?)`,
        args: [colaborador.id, item.aquisitivoInicio, item.aquisitivoFim, item.diasDireito, item.abono ? 1 : 0],
      });
      periodoId = Number(info.lastInsertRowid);
      criados++;
    }

    await db.execute({
      sql: "DELETE FROM lancamentos_ferias WHERE periodo_aquisitivo_id = ? AND observacao = ?",
      args: [periodoId, marcador],
    });
    if (item.diasGozados > 0) {
      await db.execute({
        sql: `INSERT INTO lancamentos_ferias
           (periodo_aquisitivo_id, origem, status, dias, data_inicio_gozo, data_fim_gozo, abono, dias_abono, observacao, criado_por)
         VALUES (?, 'manual', 'concluida', ?, ?, ?, 0, 0, ?, 'Importação de arquivo')`,
        args: [periodoId, item.diasGozados, item.aquisitivoFim, item.aquisitivoFim, marcador],
      });
    }
  }

  return { atualizados, criados, descartados };
}
