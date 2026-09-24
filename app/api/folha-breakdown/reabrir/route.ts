import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { reabrirCompetencia } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

/**
 * Reabre um mês fechado. Descarta o retrato congelado — a competência volta a
 * ser recalculada com o cadastro atual. As verbas extras importadas não são
 * tocadas: elas valem com o mês aberto ou fechado.
 *
 * Gestor liberado pro Breakdown só vê — fechar/reabrir competência é do RH.
 */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Informe competencia no formato AAAA-MM." }, { status: 400 });
  }

  const removidas = await reabrirCompetencia(parsed.data.competencia);
  return Response.json({ removidas, fechado: false });
}
