import { obterSessaoAtual } from "@/lib/auth/sessao";
import { enviarEmailDaFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

/** RH clica em "Concluir" na tela de Registrar entrega — é aqui que o e-mail de fato sai. Admin-only. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const resultado = await enviarEmailDaFicha(id, new URL(request.url).origin);
  return Response.json(resultado);
}
