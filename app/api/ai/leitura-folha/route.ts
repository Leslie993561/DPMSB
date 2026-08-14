import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";

export const runtime = "nodejs";

const schema = z.object({
  competencia: z.string(),
  totais: z.object({
    colaboradores: z.number(),
    salarioBase: z.number(),
    fgts: z.number(),
    valeTransporte: z.number(),
    valeAlimentacao: z.number(),
    custoTotal: z.number(),
  }),
  porDepartamento: z.array(z.object({ departamento: z.string(), custoTotal: z.number() })),
});

/**
 * Gera só a NARRATIVA em cima de números já calculados pelo motor
 * determinístico (`lib/db/folhaBreakdown.ts`) — o modelo nunca soma, nunca
 * calcula, apenas interpreta o que já foi enviado no prompt. Mesmo princípio
 * de `lib/ai/tools.ts` para o chat.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { competencia, totais, porDepartamento } = parsed.data;

  let client;
  try {
    client = getAnthropicClient();
  } catch (err) {
    return Response.json(
      { erro: err instanceof Error ? err.message : "IA indisponível.", indisponivel: true },
      { status: 200 },
    );
  }

  const departamentosOrdenados = [...porDepartamento].sort((a, b) => b.custoTotal - a.custoTotal);

  const prompt = `Você é um analista de Departamento Pessoal. Escreva uma leitura executiva curta (4 a 6 frases,
em português, sem listas) do breakdown de folha da competência ${competencia}, usando SOMENTE os números abaixo
(não invente nem recalcule nada):

- Colaboradores no fechamento: ${totais.colaboradores}
- Total de salários base: R$ ${totais.salarioBase.toFixed(2)}
- FGTS do mês: R$ ${totais.fgts.toFixed(2)}
- Vale-transporte (custo empresa): R$ ${totais.valeTransporte.toFixed(2)}
- Vale-alimentação: R$ ${totais.valeAlimentacao.toFixed(2)}
- Custo total: R$ ${totais.custoTotal.toFixed(2)}
- Custo por departamento (do maior para o menor): ${departamentosOrdenados
    .map((d) => `${d.departamento}: R$ ${d.custoTotal.toFixed(2)}`)
    .join(", ")}

Destaque o departamento de maior custo e qualquer ponto que mereça atenção do DP.`;

  const resposta = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const texto = resposta.content.find((b) => b.type === "text")?.text ?? "";
  return Response.json({ texto });
}
