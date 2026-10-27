import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "./client";

/** Validade do link de entrada enviado por e-mail. */
const VALIDADE_MINUTOS = 15;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Gera um link de uso único para o e-mail. Só o hash do token fica no banco. */
export async function criarLinkLogin(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM login_links WHERE expira_em < now() - interval '1 day'", args: [] });
  await db.execute({
    sql: "INSERT INTO login_links (token_hash, email, expira_em) VALUES (?, ?, now() + (? || ' minutes')::interval)",
    args: [hash(token), email, String(VALIDADE_MINUTOS)],
  });
  return token;
}

/** Consome o link (uso único): devolve o e-mail se válido, senão null. */
export async function consumirLinkLogin(token: string): Promise<string | null> {
  const db = await getDb();
  const r = await db.execute({
    sql: "UPDATE login_links SET usado_em = now() WHERE token_hash = ? AND usado_em IS NULL AND expira_em > now() RETURNING email",
    args: [hash(token)],
  });
  return (r.rows as unknown as { email: string }[])[0]?.email ?? null;
}
