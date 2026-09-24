import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { dispensarTrocaVencida } from "@/lib/sst/fichas";

export const runtime = "nodejs";

const schema = z.object({
  colaboradorId: z.number().int().positive(),
  epi: z.string().trim().min(1),
  dataTroca: z.string().trim().min(1),
});

/** RH dispensa o aviso de "troca vencida" de um EPI específico (ex.: já foi trocado por fora, ou descartado). Admin-only. */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    await dispensarTrocaVencida(parsed.data.colaboradorId, parsed.data.epi, parsed.data.dataTroca);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
