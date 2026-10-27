import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/storage";
import { excluirDocumentoBeneficio, obterDocumentoBeneficio } from "@/lib/db/beneficiosDocumentos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function soAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const doc = await obterDocumentoBeneficio(Number((await params).id));
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
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  return (await excluirDocumentoBeneficio(Number((await params).id)))
    ? Response.json({ ok: true })
    : Response.json({ erro: "Documento não encontrado." }, { status: 404 });
}
