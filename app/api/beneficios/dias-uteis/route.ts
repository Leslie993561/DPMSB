import { z } from "zod";
import { sincronizarRetratoReaberto } from "@/lib/db/folhaBreakdown";
import { bloquearSeFechada, competenciaDeAnoMes } from "@/lib/db/fechamento";
import { listarDiasUteisAno, definirDiasUteis } from "@/lib/db/beneficiosDiasUteis";

export const runtime = "nodejs";

const schemaPatch = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  diasUteis: z.coerce.number().int().min(0).max(31),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ ano, meses: await listarDiasUteisAno(ano) });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = schemaPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { ano, mes, diasUteis } = parsed.data;

  // Dias úteis mudam o VT de todo mundo naquele mês — é edição da competência
  // como qualquer outra, e mês fechado não aceita.
  const bloqueio = await bloquearSeFechada(competenciaDeAnoMes(ano, mes));
  if (bloqueio) return bloqueio;

  await definirDiasUteis(ano, mes, diasUteis);
  await sincronizarRetratoReaberto(competenciaDeAnoMes(ano, mes));
  return Response.json({ ano, meses: await listarDiasUteisAno(ano) });
}
