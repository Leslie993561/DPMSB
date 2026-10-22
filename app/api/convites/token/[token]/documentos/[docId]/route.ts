import { buscarConvitePorToken, convitePodeSubmeter } from "@/lib/db/convites";
import { removerDocumentoEnviado } from "@/lib/db/conviteDocumentos";

export const runtime = "nodejs";

/** Rota pública (token = credencial): a pessoa remove um anexo que ela mesma enviou por este link. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeSubmeter(convite) || convite.colaboradorId === null) {
    return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });
  }
  const ok = await removerDocumentoEnviado(convite.colaboradorId, Number(docId));
  if (!ok) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  return Response.json({ ok: true });
}
