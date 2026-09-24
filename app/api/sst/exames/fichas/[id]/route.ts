import { obterSessaoAtual } from "@/lib/auth/sessao";
import { excluirFichaExame } from "@/lib/sst/exames";

export const runtime = "nodejs";

async function ehAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const apagada = await excluirFichaExame((await params).id);
  if (!apagada) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
