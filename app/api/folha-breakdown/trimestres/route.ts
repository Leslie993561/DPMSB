import { z } from "zod";
import { obterResumoTrimestral } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });

/** Custo por trimestre do ano — real para meses fechados, projeção com a folha atual para o resto. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ ano: searchParams.get("ano") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?ano=AAAA." }, { status: 400 });
  }

  const trimestres = await obterResumoTrimestral(parsed.data.ano);
  return Response.json({ trimestres });
}
