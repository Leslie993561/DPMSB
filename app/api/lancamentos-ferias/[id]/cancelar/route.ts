import { z } from "zod";
import { ErroValidacaoFerias, cancelarLancamento } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

const schema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo do cancelamento."),
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

export async function POST(request: Request, ctx: RouteContext<"/api/lancamentos-ferias/[id]/cancelar">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const lancamento = cancelarLancamento(Number(id), parsed.data);
    return Response.json({ lancamento });
  } catch (err) {
    if (err instanceof ErroValidacaoFerias) {
      return Response.json({ erro: err.message }, { status: 400 });
    }
    throw err;
  }
}
