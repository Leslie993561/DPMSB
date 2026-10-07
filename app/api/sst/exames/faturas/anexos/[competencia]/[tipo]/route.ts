import { obterSessaoAtual } from "@/lib/auth/sessao";
import { baixarArquivoPrivado } from "@/lib/storage";
import { excluirAnexoFatura, obterAnexoFatura } from "@/lib/sst/faturasAnexos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ competencia: string; tipo: string }> };

async function soAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

export async function GET(_request: Request, { params }: Ctx) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const { competencia, tipo } = await params;
  const anexo = await obterAnexoFatura(competencia, tipo);
  if (!anexo) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });
  const resposta = await baixarArquivoPrivado(anexo.url);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o documento." }, { status: 502 });
  return new Response(resposta.body, {
    headers: {
      "Content-Type": resposta.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${anexo.nome.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const { competencia, tipo } = await params;
  return (await excluirAnexoFatura(competencia, tipo))
    ? Response.json({ ok: true })
    : Response.json({ erro: "Documento não encontrado." }, { status: 404 });
}
