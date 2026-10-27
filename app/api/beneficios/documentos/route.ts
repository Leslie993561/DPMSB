import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";
import { FORNECEDORES_BENEFICIO, listarDocumentosBeneficio, salvarDocumentoBeneficio } from "@/lib/db/beneficiosDocumentos";

export const runtime = "nodejs";

const TAMANHO_MAX = 15 * 1024 * 1024;
const TIPOS_ARQUIVO = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

async function soAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

export async function GET() {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  return Response.json({ documentos: await listarDocumentosBeneficio() });
}

/** Recebe fornecedor, mês (aaaa-mm) e um ou mais arquivos no campo "arquivos". */
export async function POST(request: Request) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  if (!blobConfigurado()) return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });

  const form = await request.formData();
  const fornecedor = String(form.get("fornecedor") ?? "");
  const competencia = String(form.get("competencia") ?? "");
  if (!(FORNECEDORES_BENEFICIO as readonly string[]).includes(fornecedor)) return Response.json({ erro: "Escolha o fornecedor." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return Response.json({ erro: "Escolha o mês." }, { status: 400 });

  const arquivos = form.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (arquivos.length === 0) return Response.json({ erro: "Anexe ao menos um arquivo." }, { status: 400 });
  for (const a of arquivos) {
    if (!TIPOS_ARQUIVO.includes(a.type)) return Response.json({ erro: `"${a.name}": só é permitido PDF, imagem ou planilha.` }, { status: 400 });
    if (a.size > TAMANHO_MAX) return Response.json({ erro: `"${a.name}" passa de 15MB.` }, { status: 400 });
  }

  for (const a of arquivos) {
    const { url, nome } = await subirArquivoPrivado("beneficios/documentos", a.name || "documento", a);
    await salvarDocumentoBeneficio(fornecedor, competencia, url, nome);
  }
  return Response.json({ ok: true, anexados: arquivos.length }, { status: 201 });
}
