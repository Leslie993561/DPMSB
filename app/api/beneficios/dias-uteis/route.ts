import { z } from "zod";
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
  return Response.json({ ano, meses: listarDiasUteisAno(ano) });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = schemaPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { ano, mes, diasUteis } = parsed.data;
  definirDiasUteis(ano, mes, diasUteis);
  return Response.json({ ano, meses: listarDiasUteisAno(ano) });
}
