import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarRiscosDaFuncao } from "@/lib/sst/exames";

export const runtime = "nodejs";

const schema = z.object({
  funcao: z.string().trim().min(1),
  riscos: z
    .array(
      z.object({
        tipo: z.enum(["fisico", "quimico", "biologico", "ergonomico"]),
        descricao: z.string().trim().min(1),
      }),
    )
    .default([]),
});

/** RH monta a Matriz Ocupacional (riscos de cada função). Admin-only. */
export async function PUT(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    await atualizarRiscosDaFuncao(parsed.data.funcao, parsed.data.riscos);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
