import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";

export const runtime = "nodejs";

// A Vercel recusa corpo de requisição acima de ~4.5MB antes até de chegar aqui
// (devolve texto puro, não JSON) — o teto fica abaixo disso pra sempre sobrar
// espaço pro resto do multipart e a rota conseguir devolver um erro decente.
const TAMANHO_MAX = 4 * 1024 * 1024; // 4MB

/** Sobe o PDF do programa (PCMSO/LTCAT/PGR) antes de registrar a nova versão. */
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
  if (arquivo.size > TAMANHO_MAX) return Response.json({ erro: "O PDF não pode passar de 4MB." }, { status: 400 });

  const { url, nome } = await subirArquivoPrivado("sst/programas-saude", arquivo.name || "anexo.pdf", arquivo);
  return Response.json({ url, nome }, { status: 201 });
}
