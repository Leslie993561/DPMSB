import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/blob";
import { obterDocumentoFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

/** RH baixa o PDF anexado a uma ficha (visão do histórico do colaborador). Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  const documento = await obterDocumentoFicha(id);
  if (!documento?.anexoUrl) return Response.json({ erro: "Sem anexo para esta ficha." }, { status: 404 });

  const resposta = await baixarArquivoPrivado(documento.anexoUrl);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o anexo." }, { status: 502 });

  return new Response(resposta.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(documento.anexoNome ?? "anexo.pdf").replace(/"/g, "")}"`,
    },
  });
}
