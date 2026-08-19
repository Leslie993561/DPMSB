import { z } from "zod";
import { obterResumoAnualBeneficios } from "@/lib/db/beneficiosRateio";

export const runtime = "nodejs";

const schema = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });

/** Custo de benefícios por mês do ano — usado no gráfico "Custo de benefícios por mês" do Dashboard. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ ano: searchParams.get("ano") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?ano=AAAA." }, { status: 400 });
  }

  const meses = await obterResumoAnualBeneficios(parsed.data.ano);
  return Response.json({ meses });
}
