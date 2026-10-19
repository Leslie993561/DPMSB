import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaDho } from "@/lib/auth/perfil";
import { listarKits } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  return Response.json({ kits: await listarKits() });
}
