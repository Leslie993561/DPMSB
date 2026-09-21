import { limparCookieSessao } from "@/lib/auth/sessao";

export const runtime = "nodejs";

export async function POST() {
  await limparCookieSessao();
  return Response.json({ ok: true });
}
