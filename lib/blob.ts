import "server-only";
import { put } from "@vercel/blob";

/** true assim que BLOB_READ_WRITE_TOKEN existir (criado junto do Blob store da Vercel). */
export function blobConfigurado(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Sobe um arquivo para o Vercel Blob (store PRIVADO — nunca público, são
 * documentos de colaborador/ficha assinada). A URL devolvida só é legível com
 * o token: baixar sempre passa por uma rota nossa que faz o fetch com
 * Authorization e repassa os bytes — nunca linkamos a URL do Blob direto pro
 * navegador.
 */
export async function subirArquivoPrivado(pasta: string, nomeOriginal: string, arquivo: Blob): Promise<{ url: string; nome: string }> {
  const extensao = nomeOriginal.includes(".") ? nomeOriginal.slice(nomeOriginal.lastIndexOf(".")) : "";
  const chave = `${pasta}/${crypto.randomUUID()}${extensao}`;
  const resultado = await put(chave, arquivo, { access: "private", addRandomSuffix: false });
  return { url: resultado.url, nome: nomeOriginal };
}

/** Busca os bytes de um arquivo privado do Blob (usa o token — nunca exponha a URL crua ao navegador). */
export async function baixarArquivoPrivado(url: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
}
