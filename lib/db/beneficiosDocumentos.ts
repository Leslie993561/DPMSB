import "server-only";
import { getDb } from "./client";

/** Fornecedores/contratos de benefício que recebem documento mensal. */
export const FORNECEDORES_BENEFICIO = ["Sólides", "Flash", "Porto Seguro", "TotalPass"] as const;
export type FornecedorBeneficio = (typeof FORNECEDORES_BENEFICIO)[number];

export interface DocumentoBeneficio {
  id: number;
  fornecedor: FornecedorBeneficio;
  /** aaaa-mm */
  competencia: string;
  nome: string;
  criadoEm: string;
}

interface Linha {
  id: number;
  fornecedor: FornecedorBeneficio;
  competencia: string;
  nome: string;
  criado_em: string;
}

export async function listarDocumentosBeneficio(): Promise<DocumentoBeneficio[]> {
  const db = await getDb();
  const r = await db.execute("SELECT id, fornecedor, competencia, nome, criado_em FROM beneficios_documentos ORDER BY competencia DESC, id DESC");
  return (r.rows as unknown as Linha[]).map((l) => ({ id: l.id, fornecedor: l.fornecedor, competencia: l.competencia, nome: l.nome, criadoEm: l.criado_em }));
}

export async function salvarDocumentoBeneficio(fornecedor: string, competencia: string, url: string, nome: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "INSERT INTO beneficios_documentos (fornecedor, competencia, url, nome) VALUES (?, ?, ?, ?)",
    args: [fornecedor, competencia, url, nome],
  });
}

export async function obterDocumentoBeneficio(id: number): Promise<{ url: string; nome: string } | null> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT url, nome FROM beneficios_documentos WHERE id = ?", args: [id] });
  return (r.rows as unknown as { url: string; nome: string }[])[0] ?? null;
}

export async function excluirDocumentoBeneficio(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute({ sql: "DELETE FROM beneficios_documentos WHERE id = ? RETURNING id", args: [id] });
  return r.rows.length > 0;
}
