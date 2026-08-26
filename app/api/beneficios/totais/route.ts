import { z } from "zod";
import { bloquearSeFechada, competenciaDeAnoMes } from "@/lib/db/fechamento";
import { listarTotaisAno, definirTotaisDoMes } from "@/lib/db/beneficiosTotais";

export const runtime = "nodejs";

/**
 * `null` é um valor legítimo aqui: significa "esqueça o total que eu informei,
 * volte a usar o calculado pelo cadastro". Ausente significa "não mexa nesta
 * verba". Por isso `.nullable()` sem `.optional()` embrulhado num optional.
 */
const valor = z.coerce.number().min(0).nullable().optional();

const schemaPatch = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  vt: valor,
  vm: valor,
  vr: valor,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ ano, meses: await listarTotaisAno(ano) });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = schemaPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { ano, mes, ...totais } = parsed.data;

  const bloqueio = await bloquearSeFechada(competenciaDeAnoMes(ano, mes));
  if (bloqueio) return bloqueio;

  await definirTotaisDoMes(ano, mes, totais);
  return Response.json({ ano, meses: await listarTotaisAno(ano) });
}
