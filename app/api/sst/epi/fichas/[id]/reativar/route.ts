import { obterSessaoAtual } from "@/lib/auth/sessao";
import { reativarFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

/** RH reativa o link de assinatura expirado (mesmo link, nova validade). Admin-only. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await obterSessaoAtual())?.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }
  const ok = await reativarFicha((await params).id);
  if (!ok) return Response.json({ erro: "Ficha não encontrada ou já assinada." }, { status: 404 });
  return Response.json({ ok: true });
}
