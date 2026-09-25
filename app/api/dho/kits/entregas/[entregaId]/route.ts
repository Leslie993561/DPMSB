import { obterSessaoAtual } from "@/lib/auth/sessao";
import { excluirEntregaKit } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ entregaId: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { entregaId } = await params;
  await excluirEntregaKit(Number(entregaId));
  return Response.json({ ok: true });
}
