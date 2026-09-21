import { z } from "zod";
import { definirPermissoesGestor, listarPermissoesGestor } from "@/lib/db/acessoGestores";

export const runtime = "nodejs";

const schema = z.object({
  liberados: z.array(z.string()),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/acesso-gestores/[id]/permissoes">) {
  const { id } = await ctx.params;
  return Response.json({ liberados: await listarPermissoesGestor(Number(id)) });
}

export async function PUT(request: Request, ctx: RouteContext<"/api/acesso-gestores/[id]/permissoes">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const liberados = await definirPermissoesGestor(Number(id), parsed.data.liberados);
  return Response.json({ liberados });
}
