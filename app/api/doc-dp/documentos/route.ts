import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";
import { categoriaValida, listarDocumentosDocDp, salvarDocumentoDocDp } from "@/lib/db/docDp";

export const runtime = "nodejs";

const TAMANHO_MAX = 15 * 1024 * 1024;
const TIPOS_ARQUIVO = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

async function soAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

/** Lista os documentos de uma aba num ano: ?categoria=beneficios&ano=2026. Gestor liberado só lê (proxy). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoria = searchParams.get("categoria") ?? "";
  const ano = searchParams.get("ano") ?? "";
  if (!categoriaValida(categoria) || !/^\d{4}$/.test(ano)) return Response.json({ erro: "Parâmetros inválidos." }, { status: 400 });
  return Response.json({ documentos: await listarDocumentosDocDp(categoria, ano) });
}

/** Recebe categoria, mês (aaaa-mm), rótulo opcional e um ou mais arquivos no campo "arquivos". */
export async function POST(request: Request) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  if (!blobConfigurado()) return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });

  const form = await request.formData();
  const categoria = String(form.get("categoria") ?? "");
  const competencia = String(form.get("competencia") ?? "");
  const rotulo = String(form.get("rotulo") ?? "").trim().slice(0, 80) || null;
  if (!categoriaValida(categoria)) return Response.json({ erro: "Aba inválida." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return Response.json({ erro: "Escolha o mês." }, { status: 400 });

  const arquivos = form.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (arquivos.length === 0) return Response.json({ erro: "Anexe ao menos um arquivo." }, { status: 400 });
  for (const a of arquivos) {
    if (!TIPOS_ARQUIVO.includes(a.type)) return Response.json({ erro: `"${a.name}": só é permitido PDF, imagem, Word ou planilha.` }, { status: 400 });
    if (a.size > TAMANHO_MAX) return Response.json({ erro: `"${a.name}" passa de 15MB.` }, { status: 400 });
  }

  for (const a of arquivos) {
    const { url, nome } = await subirArquivoPrivado(`doc-dp/${categoria}`, a.name || "documento", a);
    await salvarDocumentoDocDp(categoria, competencia, rotulo, url, nome);
  }
  return Response.json({ ok: true, anexados: arquivos.length }, { status: 201 });
}
