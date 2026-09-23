import { obterSessaoAtual } from "@/lib/auth/sessao";
import { excluirFicha, obterDocumentoFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

async function ehAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

/** Documento da ficha com o comprovante de assinatura — só o RH vê. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const documento = await obterDocumentoFicha((await params).id);
  if (!documento) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ documento });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const apagada = await excluirFicha((await params).id);
  if (!apagada) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
