import { z } from "zod";
import { calcularRescisao } from "@/lib/calc";

export const runtime = "nodejs";

const schema = z.object({
  tipo: z.enum([
    "sem_justa_causa",
    "pedido_demissao",
    "justa_causa",
    "acordo_484a",
    "termino_contrato_determinado",
  ]),
  salarioBase: z.coerce.number().positive(),
  dataAdmissao: z.iso.date(),
  dataDesligamento: z.iso.date(),
  diasTrabalhadosNoMes: z.coerce.number().min(0).max(31),
  avisoPrevioIndenizado: z.coerce.boolean(),
  feriasVencidasDias: z.coerce.number().min(0).max(30).default(0),
  mesesTrabalhadosNoAnoParaDecimoTerceiro: z.coerce.number().min(0).max(12),
  decimoTerceiroAdiantado: z.coerce.number().min(0).default(0),
  dependentes: z.coerce.number().min(0).default(0),
  saldoFgtsDepositado: z.coerce.number().min(0).optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { dataAdmissao, dataDesligamento, ...resto } = parsed.data;
  const dataAdmissaoDate = new Date(dataAdmissao);
  const dataDesligamentoDate = new Date(dataDesligamento);

  if (dataDesligamentoDate <= dataAdmissaoDate) {
    return Response.json(
      { erro: "A data de desligamento deve ser posterior à data de admissão." },
      { status: 400 },
    );
  }

  const resultado = calcularRescisao({
    ...resto,
    dataAdmissao: dataAdmissaoDate,
    dataDesligamento: dataDesligamentoDate,
  });

  return Response.json({ resultado });
}
