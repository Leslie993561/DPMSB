import "server-only";
import { sstQuery } from "./db";

export const TIPOS_ANEXO_FATURA = ["fatura", "nf", "boleto"] as const;
export type TipoAnexoFatura = (typeof TIPOS_ANEXO_FATURA)[number];

export interface AnexoFatura {
  /** aaaa-mm */
  competencia: string;
  tipo: TipoAnexoFatura;
  nome: string;
}

export async function listarAnexosFatura(): Promise<AnexoFatura[]> {
  return sstQuery<AnexoFatura>("SELECT competencia, tipo, nome FROM sst_faturas_anexos ORDER BY competencia DESC");
}

/** Grava (ou substitui) o documento daquele tipo no mês. */
export async function salvarAnexoFatura(competencia: string, tipo: TipoAnexoFatura, url: string, nome: string): Promise<void> {
  await sstQuery(
    `INSERT INTO sst_faturas_anexos (competencia, tipo, url, nome) VALUES ($1, $2, $3, $4)
     ON CONFLICT (competencia, tipo) DO UPDATE SET url = EXCLUDED.url, nome = EXCLUDED.nome, created_at = now()`,
    [competencia, tipo, url, nome],
  );
}

export async function obterAnexoFatura(competencia: string, tipo: string): Promise<{ url: string; nome: string } | null> {
  const [a] = await sstQuery<{ url: string; nome: string }>(
    "SELECT url, nome FROM sst_faturas_anexos WHERE competencia = $1 AND tipo = $2",
    [competencia, tipo],
  );
  return a ?? null;
}

export async function excluirAnexoFatura(competencia: string, tipo: string): Promise<boolean> {
  const apagados = await sstQuery<{ tipo: string }>(
    "DELETE FROM sst_faturas_anexos WHERE competencia = $1 AND tipo = $2 RETURNING tipo",
    [competencia, tipo],
  );
  return apagados.length > 0;
}
