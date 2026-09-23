import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/blob";
import { buscarDocumento, excluirDocumento } from "@/lib/db/colaboradorDocumentos";

export const runtime = "nodejs";

async function exigirAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

/** Baixa o documento anexado (proxy: a URL do Blob é privada, só o servidor tem o token). Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id, docId } = await params;
  const documento = await buscarDocumento(Number(docId));
  if (!documento || documento.colaboradorId !== Number(id)) {
    return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  const resposta = await baixarArquivoPrivado(documento.url);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o arquivo." }, { status: 502 });

  return new Response(resposta.body, {
    headers: {
      "Content-Type": resposta.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${documento.nome.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id, docId } = await params;
  const documento = await buscarDocumento(Number(docId));
  if (!documento || documento.colaboradorId !== Number(id)) {
    return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  }
  await excluirDocumento(documento.id);
  return Response.json({ ok: true });
}
