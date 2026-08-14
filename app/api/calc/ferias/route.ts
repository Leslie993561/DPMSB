import { z } from "zod";
import { avaliarPrazoConcessao, calcularFerias } from "@/lib/calc";

export const runtime = "nodejs";

const schema = z.object({
  salarioBase: z.coerce.number().positive(),
  diasDireito: z.coerce.number().min(1).max(30),
  diasGozados: z.coerce.number().min(1).max(30),
  abonoPecuniario: z.coerce.boolean(),
  dependentes: z.coerce.number().min(0).default(0),
  periodoAquisitivoFim: z.iso.date(),
  dataPagamento: z.iso.date(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { salarioBase, diasDireito, diasGozados, abonoPecuniario, dependentes, periodoAquisitivoFim, dataPagamento } =
    parsed.data;

  if (diasGozados > diasDireito) {
    return Response.json(
      { erro: "Dias gozados não podem exceder os dias de direito." },
      { status: 400 },
    );
  }

  const dataPagamentoDate = new Date(dataPagamento);
  const resultado = calcularFerias({
    salarioBase,
    diasDireito,
    diasGozados,
    abonoPecuniario,
    dependentes,
    competencia: dataPagamentoDate,
  });

  const prazo = avaliarPrazoConcessao(new Date(periodoAquisitivoFim), dataPagamentoDate);

  return Response.json({ resultado, prazo });
}
