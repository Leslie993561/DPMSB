import { z } from "zod";
import { gerarRateio, upsertOverrideRateio } from "@/lib/db/beneficiosRateio";
import { bloquearSeFechada } from "@/lib/db/fechamento";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ competencia: searchParams.get("competencia") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?competencia=AAAA-MM." }, { status: 400 });
  }

  const { linhas, diasUteis } = await gerarRateio(parsed.data.competencia);
  return Response.json({ diasUteis, linhas });
}

const schemaEditar = z.object({
  colaboradorId: z.number().int().positive(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  valeTransporte: z.number().min(0),
});

/** RH corrige na hora o VT/VM de um colaborador nesta competência — mesmo mecanismo da importação de planilha (grava em `beneficios_rateio_extras`), só que célula a célula. */
export async function PATCH(request: Request) {
  const parsed = schemaEditar.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const bloqueio = await bloquearSeFechada(parsed.data.competencia);
  if (bloqueio) return bloqueio;

  await upsertOverrideRateio(parsed.data.colaboradorId, parsed.data.competencia, {
    valeTransporte: parsed.data.valeTransporte,
    valeAlimentacao: null,
    variaveis: null,
  });
  return Response.json({ ok: true });
}
