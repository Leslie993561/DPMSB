import { buscarColaborador } from "@/lib/db/colaboradores";
import { listarPeriodosPorColaborador } from "@/lib/db/periodosAquisitivos";

export const runtime = "nodejs";

/**
 * Só lê. Período aquisitivo não é mais gerado automaticamente aqui — vem do
 * relatório do DP por importação (ver o comentário em lib/db/periodosAquisitivos.ts).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/colaboradores/[id]/periodos">,
) {
  const { id } = await ctx.params;
  const colaborador = await buscarColaborador(Number(id));
  if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  return Response.json({ periodos: await listarPeriodosPorColaborador(colaborador.id) });
}
