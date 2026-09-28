import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarEventoCalendario, excluirEventoCalendario } from "@/lib/db/dho";
import { schemaEvento } from "../route";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  await excluirEventoCalendario(Number(id));
  return Response.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaEvento.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await params;
  const evento = await atualizarEventoCalendario(Number(id), { ...parsed.data, dataFim: parsed.data.dataFim ?? null });
  return Response.json({ evento });
}
