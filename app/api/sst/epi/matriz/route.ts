import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarEpisExtrasDaFuncao } from "@/lib/sst/epi";

export const runtime = "nodejs";

const schema = z.object({
  funcao: z.string().trim().min(1),
  epis: z.array(z.string().trim().min(1)).default([]),
});

/** RH adiciona EPI(s) extra(s) a uma função da matriz (além dos fixos). Admin-only, mesmo padrão de /api/sst/epi/fichas. */
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
    await atualizarEpisExtrasDaFuncao(parsed.data.funcao, parsed.data.epis);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
