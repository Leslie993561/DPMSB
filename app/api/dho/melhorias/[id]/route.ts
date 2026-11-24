import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaDho } from "@/lib/auth/perfil";
import { atualizarMelhoriaEmpresa, excluirMelhoriaEmpresa, marcarMelhoriaImplementada } from "@/lib/db/dho";
import { schemaMelhoria } from "../route";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const corpo = await request.json();
  // Só marcar/desmarcar "implementado" (caixinha ao lado do item).
  if (corpo && typeof corpo === "object" && typeof corpo.implementado === "boolean" && Object.keys(corpo).length === 1) {
    await marcarMelhoriaImplementada(Number((await params).id), corpo.implementado);
    return Response.json({ ok: true });
  }

  const parsed = schemaMelhoria.safeParse(corpo);
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const item = await atualizarMelhoriaEmpresa(Number((await params).id), parsed.data);
  if (!item) return Response.json({ erro: "Item não encontrado." }, { status: 404 });
  return Response.json({ item });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  await excluirMelhoriaEmpresa(Number((await params).id));
  return Response.json({ ok: true });
}
