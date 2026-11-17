import "server-only";
import { getDb } from "./client";
import { CATEGORIAS_DOC_DP, type CategoriaDocDp } from "@/lib/docDp";

export interface DocumentoDocDp {
  id: number;
  categoria: CategoriaDocDp;
  /** aaaa-mm */
  competencia: string;
  rotulo: string | null;
  nome: string;
  criadoEm: string;
}

interface Linha {
  id: number;
  categoria: CategoriaDocDp;
  competencia: string;
  rotulo: string | null;
  nome: string;
  criado_em: string;
}

export function categoriaValida(c: string): c is CategoriaDocDp {
  return (CATEGORIAS_DOC_DP as readonly string[]).includes(c);
}

export async function listarDocumentosDocDp(categoria: CategoriaDocDp, ano: string): Promise<DocumentoDocDp[]> {
  const db = await getDb();
  const r = await db.execute({
    sql: "SELECT id, categoria, competencia, rotulo, nome, criado_em FROM doc_dp_documentos WHERE categoria = ? AND competencia LIKE ? ORDER BY competencia, id",
    args: [categoria, `${ano}-%`],
  });
  return (r.rows as unknown as Linha[]).map((l) => ({
    id: l.id,
    categoria: l.categoria,
    competencia: l.competencia,
    rotulo: l.rotulo,
    nome: l.nome,
    criadoEm: l.criado_em,
  }));
}

export async function salvarDocumentoDocDp(categoria: string, competencia: string, rotulo: string | null, url: string, nome: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO doc_dp_documentos (categoria, competencia, rotulo, url, nome) VALUES (?, ?, ?, ?, ?)",
    args: [categoria, competencia, rotulo, url, nome],
  });
}

export async function obterDocumentoDocDp(id: number, categoria: string): Promise<{ url: string; nome: string } | null> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT url, nome FROM doc_dp_documentos WHERE id = ? AND categoria = ?", args: [id, categoria] });
  return (r.rows as unknown as { url: string; nome: string }[])[0] ?? null;
}

export async function excluirDocumentoDocDp(id: number, categoria: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute({ sql: "DELETE FROM doc_dp_documentos WHERE id = ? AND categoria = ? RETURNING id", args: [id, categoria] });
  return r.rows.length > 0;
}
