import { z } from "zod";
import { atualizarStatusGestorAcesso } from "@/lib/db/acessoGestores";

export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(["ativo", "inativo"]),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/acesso-gestores/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const gestor = await atualizarStatusGestorAcesso(Number(id), parsed.data.status);
  if (!gestor) return Response.json({ erro: "Gestor não encontrado." }, { status: 404 });
  return Response.json({ gestor });
}
