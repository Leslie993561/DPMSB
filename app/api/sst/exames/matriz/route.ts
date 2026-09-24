import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarExamesDaFuncao, removerFuncaoDaMatriz } from "@/lib/sst/exames";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await obterSessaoAtual();
  return sessao?.tipo === "administrador" ? sessao : null;
}

const schema = z.object({
  funcao: z.string().trim().min(1),
  exames: z.array(z.string().trim().min(1)).default([]),
});

/** RH monta a matriz por função (quais exames cada função exige) — cria função nova ou edita uma já existente. Admin-only. */
export async function PUT(request: Request) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

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

const schemaRemover = z.object({ funcao: z.string().trim().min(1) });

/** RH remove um cargo/função inteiro da matriz. Admin-only. */
export async function DELETE(request: Request) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaRemover.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    await removerFuncaoDaMatriz(parsed.data.funcao);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao remover." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
