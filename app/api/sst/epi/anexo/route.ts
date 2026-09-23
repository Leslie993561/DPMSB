import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";

export const runtime = "nodejs";

const TAMANHO_MAX = 10 * 1024 * 1024; // 10MB

/** Sobe o PDF que o RH anexa ao registrar uma entrega de EPI — salvo antes de a ficha existir, a ficha guarda só a URL. */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  if (!blobConfigurado()) {
    return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });
  }

  const form = await request.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo." }, { status: 400 });
  if (arquivo.type !== "application/pdf") return Response.json({ erro: "Só é permitido anexar PDF." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAX) return Response.json({ erro: "O PDF não pode passar de 10MB." }, { status: 400 });

  const { url, nome } = await subirArquivoPrivado("sst/anexos-epi", arquivo.name || "anexo.pdf", arquivo);
  return Response.json({ url, nome }, { status: 201 });
}
