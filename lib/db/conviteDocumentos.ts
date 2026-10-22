import "server-only";
import { getDb } from "./client";
import type { DadosEstrangeiro } from "@/lib/convite/documentos";

/** `enviado_por` dos anexos feitos pelo próprio colaborador no link de auto-cadastro. */
export const ENVIADO_POR_AUTOCADASTRO = "auto-cadastro";

export interface DocumentoEnviado {
  id: number;
  tipo: string;
  arquivo: string;
  enviadoEm: string;
}

interface LinhaEnviado {
  id: number;
  tipo: string;
  nome: string;
  criado_em: string;
}

/** Anexos que a pessoa mandou pelo link (aparecem para o RH em Documentos DP). */
export async function listarDocumentosEnviados(colaboradorId: number): Promise<DocumentoEnviado[]> {
  const db = await getDb();
  const r = await db.execute({
    sql: `SELECT id, tipo, nome, criado_em FROM colaborador_documentos
          WHERE colaborador_id = ? AND enviado_por = ? AND tipo IS NOT NULL ORDER BY id`,
    args: [colaboradorId, ENVIADO_POR_AUTOCADASTRO],
  });
  return (r.rows as unknown as LinhaEnviado[]).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    arquivo: l.nome,
    enviadoEm: l.criado_em,
  }));
}

export async function adicionarDocumentoEnviado(
  colaboradorId: number,
  d: { tipo: string; nome: string; url: string },
): Promise<DocumentoEnviado> {
  const db = await getDb();
  const r = await db.execute({
    sql: `INSERT INTO colaborador_documentos (colaborador_id, nome, url, enviado_por, origem, tipo)
          VALUES (?, ?, ?, ?, 'dp', ?) RETURNING id, tipo, nome, criado_em`,
    args: [colaboradorId, d.nome, d.url, ENVIADO_POR_AUTOCADASTRO, d.tipo],
  });
  const l = r.rows[0] as unknown as LinhaEnviado;
  return { id: l.id, tipo: l.tipo, arquivo: l.nome, enviadoEm: l.criado_em };
}

/** Só remove anexo que veio do próprio link — nunca um documento que o RH anexou. */
export async function removerDocumentoEnviado(colaboradorId: number, docId: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.execute({
    sql: "DELETE FROM colaborador_documentos WHERE id = ? AND colaborador_id = ? AND enviado_por = ? AND tipo IS NOT NULL",
    args: [docId, colaboradorId, ENVIADO_POR_AUTOCADASTRO],
  });
  return (r.rowsAffected ?? 0) > 0;
}

interface LinhaEstrangeiro {
  data_naturalizacao: string | null;
  casado_com_brasileiro: boolean | null;
  filho_com_brasileiro: boolean | null;
  visto: string | null;
}

export async function buscarEstrangeiro(colaboradorId: number): Promise<DadosEstrangeiro | null> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT * FROM colaborador_estrangeiro WHERE colaborador_id = ?", args: [colaboradorId] });
  const l = r.rows[0] as unknown as LinhaEstrangeiro | undefined;
  if (!l) return null;
  return {
    dataNaturalizacao: l.data_naturalizacao,
    casadoComBrasileiro: l.casado_com_brasileiro,
    filhoComBrasileiro: l.filho_com_brasileiro,
    visto: l.visto as DadosEstrangeiro["visto"],
  };
}

export async function salvarEstrangeiro(colaboradorId: number, d: DadosEstrangeiro): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO colaborador_estrangeiro (colaborador_id, data_naturalizacao, casado_com_brasileiro, filho_com_brasileiro, visto, atualizado_em)
          VALUES (?, ?, ?, ?, ?, to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (colaborador_id) DO UPDATE SET
            data_naturalizacao = EXCLUDED.data_naturalizacao,
            casado_com_brasileiro = EXCLUDED.casado_com_brasileiro,
            filho_com_brasileiro = EXCLUDED.filho_com_brasileiro,
            visto = EXCLUDED.visto,
            atualizado_em = EXCLUDED.atualizado_em`,
    args: [colaboradorId, d.dataNaturalizacao, d.casadoComBrasileiro, d.filhoComBrasileiro, d.visto],
  });
}
