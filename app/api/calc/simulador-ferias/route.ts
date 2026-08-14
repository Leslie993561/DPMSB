import { z } from "zod";
import { calcularFerias, calcularFGTS, arredondar } from "@/lib/calc";

export const runtime = "nodejs";

const schema = z.object({
  salario: z.coerce.number().positive(),
  mediaVariaveis: z.coerce.number().min(0).default(0),
  diasFerias: z.coerce.number().min(1).max(30),
  venderAbono: z.coerce.boolean().default(false),
  adiantar13: z.coerce.boolean().default(false),
  dependentes: z.coerce.number().min(0).default(0),
  competencia: z.iso.date(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { salario, mediaVariaveis, diasFerias, venderAbono, adiantar13, dependentes, competencia } =
    parsed.data;
  const competenciaDate = new Date(competencia);
  const salarioBase = arredondar(salario + mediaVariaveis);

  const ferias = calcularFerias({
    salarioBase,
    diasDireito: 30,
    diasGozados: diasFerias,
    abonoPecuniario: venderAbono,
    dependentes,
    competencia: competenciaDate,
  });

  const fgts = calcularFGTS(salarioBase, competenciaDate);

  // Adiantamento do 13º: convenção usual da 1ª parcela — 50% do salário base
  // (sem variáveis, que só entram no cálculo do 13º integral de dezembro),
  // pago sem descontos de INSS/IRRF (retidos só na 2ª parcela).
  const adiantamento13 = adiantar13 ? arredondar(salario / 2) : 0;

  const custoTotalEmpresa = arredondar(ferias.valor + fgts.valor + adiantamento13);

  return Response.json({
    ferias,
    fgts,
    adiantamento13,
    custoTotalEmpresa,
  });
}
