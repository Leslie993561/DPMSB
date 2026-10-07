import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";
import { listarAnexosFatura, salvarAnexoFatura, TIPOS_ANEXO_FATURA } from "@/lib/sst/faturasAnexos";

export const runtime = "nodejs";

const TAMANHO_MAX = 10 * 1024 * 1024;
const TIPOS_ARQUIVO = ["application/pdf", "image/png", "image/jpeg"];

async function soAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

export async function GET() {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  return Response.json({ anexos: await listarAnexosFatura() });
}

/** Recebe o mês (aaaa-mm) e até 3 arquivos de uma vez: campos "fatura", "nf" e "boleto". */
export async function POST(request: Request) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  if (!blobConfigurado()) return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });

  const form = await request.formData();
  const competencia = String(form.get("competencia") ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return Response.json({ erro: "Escolha o mês." }, { status: 400 });

  const enviados = TIPOS_ANEXO_FATURA.flatMap((tipo) => {
    const arquivo = form.get(tipo);
    return arquivo instanceof File && arquivo.size > 0 ? [{ tipo, arquivo }] : [];
  });
  if (enviados.length === 0) return Response.json({ erro: "Anexe ao menos um arquivo." }, { status: 400 });
  for (const { arquivo } of enviados) {
    if (!TIPOS_ARQUIVO.includes(arquivo.type)) return Response.json({ erro: "Só é permitido PDF, PNG ou JPG." }, { status: 400 });
    if (arquivo.size > TAMANHO_MAX) return Response.json({ erro: `"${arquivo.name}" passa de 10MB.` }, { status: 400 });
  }

  for (const { tipo, arquivo } of enviados) {
    const { url, nome } = await subirArquivoPrivado("sst/faturas-exame", arquivo.name || tipo, arquivo);
    await salvarAnexoFatura(competencia, tipo, url, nome);
  }
  return Response.json({ ok: true, anexados: enviados.length }, { status: 201 });
}
