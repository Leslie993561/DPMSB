import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/storage";
import { excluirDocumentoDocDp, obterDocumentoDocDp } from "@/lib/db/docDp";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ categoria: string; id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { categoria, id } = await params;
  const doc = await obterDocumentoDocDp(Number(id), categoria);
  if (!doc) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  const resposta = await baixarArquivoPrivado(doc.url);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o documento." }, { status: 502 });
  return new Response(resposta.body, {
    headers: {
      "Content-Type": resposta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${doc.nome.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if ((await obterSessaoAtual())?.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });
  return (await excluirDocumentoDocDp(Number((await params).id), (await params).categoria))
    ? Response.json({ ok: true })
    : Response.json({ erro: "Documento não encontrado." }, { status: 404 });
}
