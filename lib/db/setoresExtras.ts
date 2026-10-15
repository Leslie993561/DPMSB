import "server-only";
import { getDb } from "./client";

export async function listarSetoresExtras(): Promise<string[]> {
  const db = await getDb();
  const r = await db.execute("SELECT nome FROM setores_extras ORDER BY nome");
  return r.rows.map((l) => String((l as unknown as { nome: string }).nome));
}

export async function adicionarSetorExtra(nome: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "INSERT INTO setores_extras (nome) VALUES (?) ON CONFLICT (nome) DO NOTHING", args: [nome] });
}
