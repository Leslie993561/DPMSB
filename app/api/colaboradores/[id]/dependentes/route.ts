import { listarDependentes } from "@/lib/db/colaboradorDependentes";
import { dentroDoEscopo } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: RouteContext<"/api/colaboradores/[id]/dependentes">) {
  const { id } = await ctx.params;
  if (!(await dentroDoEscopo(Number(id)))) {
    return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
  }
  return Response.json({ dependentes: await listarDependentes(Number(id)) });
}
