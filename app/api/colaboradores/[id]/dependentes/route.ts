import { listarDependentes } from "@/lib/db/colaboradorDependentes";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: RouteContext<"/api/colaboradores/[id]/dependentes">) {
  const { id } = await ctx.params;
  return Response.json({ dependentes: listarDependentes(Number(id)) });
}
