import { z } from "zod";
import { gerarRateio } from "@/lib/db/beneficiosRateio";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ competencia: searchParams.get("competencia") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?competencia=AAAA-MM." }, { status: 400 });
  }

  const { linhas, diasUteis } = gerarRateio(parsed.data.competencia);
  return Response.json({ diasUteis, linhas });
}
