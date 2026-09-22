import { obterSessaoAtual } from "@/lib/auth/sessao";

export const runtime = "nodejs";

/** Só o essencial pra telas cliente decidirem o que mostrar (botão de editar, colunas etc.) — nunca `liberados` ou `colaboradorId`. */
export async function GET() {
  const sessao = await obterSessaoAtual();
  if (!sessao) return Response.json({ tipo: null }, { status: 401 });
  return Response.json({ tipo: sessao.tipo, nome: sessao.nome, cargo: sessao.cargo });
}
