import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaDho } from "@/lib/auth/perfil";
import { obterKit } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  const kit = await obterKit(Number(id));
  if (!kit) return Response.json({ erro: "Kit não encontrado." }, { status: 404 });
  return Response.json({ kit });
}
