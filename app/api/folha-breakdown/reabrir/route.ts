import { z } from "zod";
import { reabrirCompetencia } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

/**
 * Reabre um mês fechado. Descarta o retrato congelado — a competência volta a
 * ser recalculada com o cadastro atual. As verbas extras importadas não são
 * tocadas: elas valem com o mês aberto ou fechado.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Informe competencia no formato AAAA-MM." }, { status: 400 });
  }

  const removidas = await reabrirCompetencia(parsed.data.competencia);
  return Response.json({ removidas, fechado: false });
}
