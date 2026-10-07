import { obterSessaoAtual } from "@/lib/auth/sessao";
import { excluirFaturaExame } from "@/lib/sst/faturasExame";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const { id } = await params;
  const ok = await excluirFaturaExame(id);
  return ok ? Response.json({ ok: true }) : Response.json({ erro: "Fatura não encontrada." }, { status: 404 });
}
