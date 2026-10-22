import { buscarConvitePorToken, convitePodeSubmeter, marcarConviteUsado } from "@/lib/db/convites";

export const runtime = "nodejs";

/** Rota pública (token = credencial): encerra o cadastro — depois disso o link deixa de funcionar. */
export async function POST(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeSubmeter(convite) || convite.colaboradorId === null) {
    return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });
  }
  await marcarConviteUsado(convite.id);
  return Response.json({ ok: true });
}
