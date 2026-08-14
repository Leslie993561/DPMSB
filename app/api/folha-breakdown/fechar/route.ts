import { z } from "zod";
import { fecharCompetencia } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Informe competencia no formato AAAA-MM." }, { status: 400 });
  }

  const linhas = fecharCompetencia(parsed.data.competencia);
  return Response.json({ linhas, fechado: true });
}
