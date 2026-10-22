import { z } from "zod";
import { buscarConvitePorToken, convitePodeSubmeter } from "@/lib/db/convites";
import { salvarEstrangeiro } from "@/lib/db/conviteDocumentos";
import { VISTOS } from "@/lib/convite/documentos";

export const runtime = "nodejs";

const schema = z.object({
  dataNaturalizacao: z.iso.date().nullable(),
  casadoComBrasileiro: z.boolean().nullable(),
  filhoComBrasileiro: z.boolean().nullable(),
  visto: z.enum(VISTOS).nullable(),
});

/** Rota pública (token = credencial): bloco "Estrangeiro" do checklist de documentos. */
export async function PUT(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeSubmeter(convite) || convite.colaboradorId === null) {
    return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ erro: "Dados inválidos." }, { status: 400 });
  await salvarEstrangeiro(convite.colaboradorId, parsed.data);
  return Response.json({ ok: true });
}
