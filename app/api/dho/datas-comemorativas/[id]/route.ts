import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarDataComemorativa, excluirDataComemorativa } from "@/lib/db/dho";
import { schemaDataComemorativa } from "../route";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaDataComemorativa.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await params;
  const item = await atualizarDataComemorativa(Number(id), parsed.data);
  return Response.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  await excluirDataComemorativa(Number(id));
  return Response.json({ ok: true });
}
