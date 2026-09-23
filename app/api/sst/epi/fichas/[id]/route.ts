import { obterSessaoAtual } from "@/lib/auth/sessao";
import { obterDocumentoFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

/** Documento da ficha com o comprovante de assinatura — só o RH vê. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (sessao?.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const documento = await obterDocumentoFicha((await params).id);
  if (!documento) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ documento });
}
