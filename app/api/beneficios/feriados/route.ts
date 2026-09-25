import { z } from "zod";
import { bloquearSeFechada } from "@/lib/db/fechamento";
import { listarFeriadosEmpresa, alternarFeriadoEmpresa } from "@/lib/db/beneficiosFeriados";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ ano, feriados: await listarFeriadosEmpresa(ano) });
}

const schemaPost = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
});

export async function POST(request: Request) {
  const parsed = schemaPost.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { data } = parsed.data;

  // Marcar/desmarcar um feriado muda o Vale-Transporte de todo mundo naquele
  // mês — mês fechado no Breakdown não aceita, mesma regra de dias úteis.
  const bloqueio = await bloquearSeFechada(data.slice(0, 7));
  if (bloqueio) return bloqueio;

  const resultado = await alternarFeriadoEmpresa(data);
  return Response.json(resultado);
}
