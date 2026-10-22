import "server-only";
import { getDb } from "./client";
import type { EstadoChecklist } from "@/lib/checklistAdmissional";

export async function buscarChecklist(colaboradorId: number): Promise<EstadoChecklist> {
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT dados FROM colaborador_checklist WHERE colaborador_id = ?", args: [colaboradorId] });
  const linha = r.rows[0] as unknown as { dados: string } | undefined;
  if (!linha) return {};
  try {
    return JSON.parse(linha.dados) as EstadoChecklist;
  } catch {
    return {};
  }
}

export async function salvarChecklist(colaboradorId: number, dados: EstadoChecklist): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO colaborador_checklist (colaborador_id, dados, atualizado_em)
          VALUES (?, ?, to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
          ON CONFLICT (colaborador_id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = EXCLUDED.atualizado_em`,
    args: [colaboradorId, JSON.stringify(dados)],
  });
}
