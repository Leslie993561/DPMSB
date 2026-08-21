import { buscarColaborador } from "@/lib/db/colaboradores";
import { listarHistoricoFerias } from "@/lib/db/historicoFerias";

export const runtime = "nodejs";

/** Histórico completo de férias do colaborador: todos os períodos aquisitivos com seus lançamentos. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/colaboradores/[id]/historico-ferias">,
) {
  const { id } = await ctx.params;
  const colaborador = await buscarColaborador(Number(id));
  if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  return Response.json({ periodos: await listarHistoricoFerias(colaborador.id) });
}
