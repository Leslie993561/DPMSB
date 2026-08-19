import { buscarColaborador } from "@/lib/db/colaboradores";
import { listarPeriodosPorColaborador, sincronizarPeriodos } from "@/lib/db/periodosAquisitivos";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/colaboradores/[id]/periodos">,
) {
  const { id } = await ctx.params;
  const colaborador = await buscarColaborador(Number(id));
  if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  await sincronizarPeriodos(colaborador.id, colaborador.dataAdmissao, new Date());
  return Response.json({ periodos: await listarPeriodosPorColaborador(colaborador.id) });
}
