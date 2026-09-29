import { obterSessaoAtual } from "@/lib/auth/sessao";
import { enviarEmailConvite } from "@/lib/db/convites";

export const runtime = "nodejs";

/** RH clica em "Enviar" ao lado do link de auto-cadastro. Admin-only. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { token } = await params;
  const resultado = await enviarEmailConvite(token, new URL(request.url).origin);
  return Response.json(resultado);
}
