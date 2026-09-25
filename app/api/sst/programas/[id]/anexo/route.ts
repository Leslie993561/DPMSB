import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/storage";
import { obterAnexoProgramaSaude } from "@/lib/sst/programas";

export const runtime = "nodejs";

/** RH baixa o PDF anexado a uma versão do programa. Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  const anexo = await obterAnexoProgramaSaude(id);
  if (!anexo) return Response.json({ erro: "Sem anexo para esta versão." }, { status: 404 });

  const resposta = await baixarArquivoPrivado(anexo.url);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o anexo." }, { status: 502 });

  return new Response(resposta.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(anexo.nome ?? "anexo.pdf").replace(/"/g, "")}"`,
    },
  });
}
