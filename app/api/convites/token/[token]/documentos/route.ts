import { blobConfigurado, subirArquivoPrivado } from "@/lib/storage";
import { buscarConvitePorToken, convitePodeSubmeter } from "@/lib/db/convites";
import { adicionarDocumentoEnviado, listarDocumentosEnviados } from "@/lib/db/conviteDocumentos";
import { buscarDocumentoConvite, REGRAS_ANEXO, TIPOS_MIME } from "@/lib/convite/documentos";

export const runtime = "nodejs";

const ERRO_INVALIDO = { erro: "Link inválido ou expirado." };

/** PDF de verdade começa com "%PDF" — confere o conteúdo, não só o tipo que o navegador declarou. */
async function pareceTipoDeclarado(arquivo: File, formato: "pdf" | "foto"): Promise<boolean> {
  const b = new Uint8Array(await arquivo.slice(0, 4).arrayBuffer());
  if (formato === "pdf") return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  const jpg = b[0] === 0xff && b[1] === 0xd8;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return jpg || png;
}

/** Rota pública (token = credencial): anexa UM arquivo a um item do checklist de documentos pessoais. */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeSubmeter(convite)) return Response.json(ERRO_INVALIDO, { status: 404 });
  if (convite.colaboradorId === null) {
    return Response.json({ erro: "Envie primeiro seus dados pessoais ao RH." }, { status: 409 });
  }
  if (!blobConfigurado()) {
    return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 503 });
  }

  const form = await request.formData();
  const item = buscarDocumentoConvite(String(form.get("tipo") ?? ""));
  if (!item) return Response.json({ erro: "Documento desconhecido." }, { status: 400 });
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo." }, { status: 400 });

  const formato = item.formato ?? "pdf";
  const rotuloFormato = formato === "pdf" ? "PDF" : "JPG ou PNG";
  if (!TIPOS_MIME[formato].includes(arquivo.type) || !(await pareceTipoDeclarado(arquivo, formato))) {
    return Response.json({ erro: `"${item.nome}" aceita somente arquivo ${rotuloFormato}.` }, { status: 400 });
  }
  if (arquivo.size === 0) return Response.json({ erro: "O arquivo está vazio." }, { status: 400 });
  if (arquivo.size > REGRAS_ANEXO.tamanhoMaxBytes) {
    return Response.json({ erro: "O arquivo não pode passar de 10 MB." }, { status: 400 });
  }

  const ja = await listarDocumentosEnviados(convite.colaboradorId);
  if (ja.filter((d) => d.tipo === item.chave).length >= REGRAS_ANEXO.maxArquivosPorItem) {
    return Response.json({ erro: `Máximo de ${REGRAS_ANEXO.maxArquivosPorItem} arquivos por documento.` }, { status: 400 });
  }
  if (ja.length >= REGRAS_ANEXO.maxArquivosTotal) {
    return Response.json({ erro: "Limite de arquivos do cadastro atingido." }, { status: 400 });
  }

  const { url } = await subirArquivoPrivado("colaboradores/documentos", arquivo.name || "documento", arquivo);
  // O RH vê "Identidade — rg-frente.pdf": o item do checklist + o arquivo que a pessoa mandou.
  const nome = `${item.nome} — ${(arquivo.name || "documento").slice(0, 120)}`;
  const documento = await adicionarDocumentoEnviado(convite.colaboradorId, { tipo: item.chave, nome, url });
  return Response.json({ documento }, { status: 201 });
}
