import "server-only";
import { getDb } from "./client";

/** Datas (AAAA-MM-DD) marcadas como "empresa não funciona" num ano — feriado local, ponto facultativo, recesso. */
export async function listarFeriadosEmpresa(ano: number): Promise<string[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT data FROM beneficios_feriados_empresa WHERE data LIKE ? ORDER BY data",
    args: [`${ano}-%`],
  });
  return (resultado.rows as unknown as { data: string }[]).map((l) => l.data);
}

/** Liga/desliga uma data como dia de empresa fechada — clique no calendário do Rateio. */
export async function alternarFeriadoEmpresa(data: string): Promise<{ ativo: boolean }> {
  const db = await getDb();
  const existente = await db.execute({ sql: "SELECT 1 FROM beneficios_feriados_empresa WHERE data = ?", args: [data] });
  if (existente.rows.length > 0) {
    await db.execute({ sql: "DELETE FROM beneficios_feriados_empresa WHERE data = ?", args: [data] });
    return { ativo: false };
  }
  await db.execute({ sql: "INSERT INTO beneficios_feriados_empresa (data) VALUES (?)", args: [data] });
  return { ativo: true };
}
