import { z } from "zod";
import { ErroValidacaoFerias, criarLancamentoCalculado } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

const schema = z.object({
  diasSolicitados: z.coerce.number().min(1),
  dataInicioPrevista: z.iso.date(),
  abonoSolicitado: z.coerce.boolean().default(false),
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/periodos-aquisitivos/[id]/lancamentos/calculado">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const lancamento = await criarLancamentoCalculado({
      periodoAquisitivoId: Number(id),
      diasSolicitados: parsed.data.diasSolicitados,
      dataInicioPrevista: parsed.data.dataInicioPrevista,
      abonoSolicitado: parsed.data.abonoSolicitado,
      operador: parsed.data.operador,
    });
    return Response.json({ lancamento }, { status: 201 });
  } catch (err) {
    if (err instanceof ErroValidacaoFerias) {
      return Response.json({ erro: err.message }, { status: 400 });
    }
    throw err;
  }
}
