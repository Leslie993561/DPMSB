import { z } from "zod";
import { ErroValidacaoFerias, reverterBaixa } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

const schema = z.object({
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

/** Desfaz a baixa de um lançamento confirmado — volta para "programada" (Confirmar gozo). */
export async function POST(request: Request, ctx: RouteContext<"/api/lancamentos-ferias/[id]/reverter">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const lancamento = reverterBaixa(Number(id), { operador: parsed.data.operador });
    return Response.json({ lancamento });
  } catch (err) {
    if (err instanceof ErroValidacaoFerias) {
      return Response.json({ erro: err.message }, { status: 400 });
    }
    throw err;
  }
}
