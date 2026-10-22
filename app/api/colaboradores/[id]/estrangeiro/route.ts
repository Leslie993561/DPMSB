import { obterSessaoAtual } from "@/lib/auth/sessao";
import { buscarEstrangeiro } from "@/lib/db/conviteDocumentos";

export const runtime = "nodejs";

/** Dados do bloco "Estrangeiro" que a pessoa preencheu no link de auto-cadastro. Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await obterSessaoAtual())?.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Colaborador inválido." }, { status: 400 });
  return Response.json({ estrangeiro: await buscarEstrangeiro(id) });
}
