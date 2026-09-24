import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarExamesDaFuncao } from "@/lib/sst/exames";

export const runtime = "nodejs";

const schema = z.object({
  funcao: z.string().trim().min(1),
  exames: z.array(z.string().trim().min(1)).default([]),
});

/** RH monta a matriz por função (quais exames cada função exige). Admin-only, mesmo padrão de /api/sst/epi/matriz. */
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
    await atualizarExamesDaFuncao(parsed.data.funcao, parsed.data.exames);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
