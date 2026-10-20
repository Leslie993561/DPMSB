import { z } from "zod";
import { obterBreakdown, listarCompetenciasFechadas } from "@/lib/db/folhaBreakdown";
import { filtrarPorEquipe } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ competencia: searchParams.get("competencia") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?competencia=AAAA-MM." }, { status: 400 });
  }

  const { linhas, fechado } = await obterBreakdown(parsed.data.competencia);
  // Gestor comum só vê a folha da própria equipe.
  return Response.json({ linhas: await filtrarPorEquipe(linhas, (l) => l.colaboradorId), fechado, competenciasFechadas: await listarCompetenciasFechadas() });
}
