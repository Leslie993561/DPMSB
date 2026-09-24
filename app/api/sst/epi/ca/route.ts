import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { definirCaEpi } from "@/lib/sst/epi";

export const runtime = "nodejs";

const schema = z.object({
  equip: z.string().trim().min(1),
  ca: z.string().trim(),
});

/** RH informa o CA de um EPI extra (o catálogo estático já tem CA fixo pros seus itens). Admin-only. */
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
    await definirCaEpi(parsed.data.equip, parsed.data.ca);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
