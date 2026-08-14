import { z } from "zod";
import { ErroValidacaoFerias, darBaixa } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

const schema = z.object({
  dataInicioReal: z.iso.date(),
  dataFimReal: z.iso.date(),
  dataRetorno: z.iso.date(),
  diasGozadosReal: z.coerce.number().min(1),
  observacaoBaixa: z.string().trim().nullable().optional(),
  anexoNome: z.string().trim().nullable().optional(),
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

export async function POST(request: Request, ctx: RouteContext<"/api/lancamentos-ferias/[id]/baixa">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  try {
    const lancamento = darBaixa(Number(id), {
      dataInicioReal: parsed.data.dataInicioReal,
      dataFimReal: parsed.data.dataFimReal,
      dataRetorno: parsed.data.dataRetorno,
      diasGozadosReal: parsed.data.diasGozadosReal,
      observacaoBaixa: parsed.data.observacaoBaixa ?? null,
      anexoNome: parsed.data.anexoNome ?? null,
      operador: parsed.data.operador,
    });
    return Response.json({ lancamento });
  } catch (err) {
    if (err instanceof ErroValidacaoFerias) {
      return Response.json({ erro: err.message }, { status: 400 });
    }
    throw err;
  }
}
