import { z } from "zod";
import { arredondar, calcularFGTS, calcularINSS, calcularIRRF } from "@/lib/calc";
import { converterParaColaboradores } from "@/lib/parsing/mappers";

export const runtime = "nodejs";

const schema = z.object({
  linhas: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  mapeamento: z.object({
    nome: z.string().nullable().optional(),
    salarioBase: z.string(),
    dependentes: z.string().nullable().optional(),
  }),
  competencia: z.iso.date(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { linhas, mapeamento, competencia } = parsed.data;
  const dataCompetencia = new Date(competencia);

  let conversao;
  try {
    conversao = converterParaColaboradores(linhas, mapeamento);
  } catch (err) {
    return Response.json(
      { erro: err instanceof Error ? err.message : "Erro ao mapear as colunas." },
      { status: 400 },
    );
  }

  const resultados = conversao.colaboradores.map((c) => {
    const inss = calcularINSS(c.salarioBase, dataCompetencia);
    const irrf = calcularIRRF(c.salarioBase - inss.valor, c.dependentes, dataCompetencia);
    const fgts = calcularFGTS(c.salarioBase, dataCompetencia);
    const liquido = arredondar(c.salarioBase - inss.valor - irrf.valor);

    return {
      nome: c.nome,
      salarioBase: c.salarioBase,
      dependentes: c.dependentes,
      inss: inss.valor,
      irrf: irrf.valor,
      fgts: fgts.valor,
      liquido,
      memoriaCalculo: [...inss.memoriaCalculo, ...irrf.memoriaCalculo, ...fgts.memoriaCalculo],
    };
  });

  const totais = resultados.reduce(
    (acc, r) => ({
      salarioBase: arredondar(acc.salarioBase + r.salarioBase),
      inss: arredondar(acc.inss + r.inss),
      irrf: arredondar(acc.irrf + r.irrf),
      fgts: arredondar(acc.fgts + r.fgts),
      liquido: arredondar(acc.liquido + r.liquido),
    }),
    { salarioBase: 0, inss: 0, irrf: 0, fgts: 0, liquido: 0 },
  );

  return Response.json({
    resultados,
    totais,
    descartadas: conversao.descartadas,
    avisoDependentes: !mapeamento.dependentes,
  });
}
