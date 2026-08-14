import { z } from "zod";
import { ErroValidacaoFerias, criarLancamentoManual } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

const schema = z.object({
  diasGozados: z.coerce.number().min(0),
  dataInicioGozo: z.iso.date(),
  dataFimGozo: z.iso.date(),
  abono: z.coerce.boolean().default(false),
  diasVendidos: z.coerce.number().min(0).default(0),
  observacao: z.string().trim().nullable().optional(),
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/periodos-aquisitivos/[id]/lancamentos/manual">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const lancamento = criarLancamentoManual({
      periodoAquisitivoId: Number(id),
      diasGozados: parsed.data.diasGozados,
      dataInicioGozo: parsed.data.dataInicioGozo,
      dataFimGozo: parsed.data.dataFimGozo,
      abono: parsed.data.abono,
      diasVendidos: parsed.data.diasVendidos,
      observacao: parsed.data.observacao ?? null,
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
