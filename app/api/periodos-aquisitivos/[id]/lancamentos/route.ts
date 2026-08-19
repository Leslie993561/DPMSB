import { listarPorPeriodo } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/periodos-aquisitivos/[id]/lancamentos">,
) {
  const { id } = await ctx.params;
  return Response.json({ lancamentos: await listarPorPeriodo(Number(id)) });
}
