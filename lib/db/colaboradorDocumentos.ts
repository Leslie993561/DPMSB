import "server-only";
import { getDb } from "./client";

export interface ColaboradorDocumento {
  id: number;
  colaboradorId: number;
  nome: string;
  url: string;
  enviadoPor: string;
  criadoEm: string;
}

interface LinhaDocumento {
  id: number;
  colaborador_id: number;
  nome: string;
  url: string;
  enviado_por: string;
  criado_em: string;
}

function paraDocumento(l: LinhaDocumento): ColaboradorDocumento {
  return {
    id: l.id,
    colaboradorId: l.colaborador_id,
    nome: l.nome,
    url: l.url,
    enviadoPor: l.enviado_por,
    criadoEm: l.criado_em,
  };
}

export async function listarDocumentos(colaboradorId: number): Promise<ColaboradorDocumento[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM colaborador_documentos WHERE colaborador_id = ? ORDER BY criado_em DESC",
    args: [colaboradorId],
  });
  return (resultado.rows as unknown as LinhaDocumento[]).map(paraDocumento);
}

export async function buscarDocumento(id: number): Promise<ColaboradorDocumento | null> {
  const db = await getDb();
  const resultado = await db.execute({ sql: "SELECT * FROM colaborador_documentos WHERE id = ?", args: [id] });
  const linha = resultado.rows[0] as unknown as LinhaDocumento | undefined;
  return linha ? paraDocumento(linha) : null;
}

export async function adicionarDocumento(
  colaboradorId: number,
  dados: { nome: string; url: string },
  enviadoPor: string,
): Promise<ColaboradorDocumento> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "INSERT INTO colaborador_documentos (colaborador_id, nome, url, enviado_por) VALUES (?, ?, ?, ?) RETURNING *",
    args: [colaboradorId, dados.nome, dados.url, enviadoPor],
  });
  return paraDocumento(resultado.rows[0] as unknown as LinhaDocumento);
}

export async function excluirDocumento(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM colaborador_documentos WHERE id = ?", args: [id] });
}
