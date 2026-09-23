import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/blob";
import { adicionarDocumento, listarDocumentos } from "@/lib/db/colaboradorDocumentos";
import { buscarColaborador } from "@/lib/db/colaboradores";

export const runtime = "nodejs";

const TAMANHO_MAX = 10 * 1024 * 1024; // 10MB
const TIPOS_ACEITOS = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function exigirAdmin() {
  const sessao = await obterSessaoAtual();
  return sessao?.tipo === "administrador" ? sessao : null;
}

/** Documentos do colaborador (RG, CNH, comprovante...) — anexos guardados no Vercel Blob. Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Colaborador inválido." }, { status: 400 });
  return Response.json({ documentos: await listarDocumentos(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirAdmin();
  if (!sessao) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Colaborador inválido." }, { status: 400 });
  const colaborador = await buscarColaborador(id);
  if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  if (!blobConfigurado()) {
    return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });
  }

  const form = await request.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo." }, { status: 400 });
  if (!TIPOS_ACEITOS.has(arquivo.type)) {
    return Response.json({ erro: "Só é permitido anexar PDF, JPG ou PNG." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAX) return Response.json({ erro: "O arquivo não pode passar de 10MB." }, { status: 400 });

  const { url, nome } = await subirArquivoPrivado("colaboradores/documentos", arquivo.name || "documento", arquivo);
  const documento = await adicionarDocumento(id, { nome, url }, sessao.email);
  return Response.json({ documento }, { status: 201 });
}
