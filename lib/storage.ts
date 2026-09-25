import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Arquivos privados (documentos de colaborador, PDF anexado à ficha de EPI)
 * ficam num bucket PRIVADO do Supabase Storage — mesmo projeto do
 * DATABASE_URL. A Service Role Key ignora RLS de propósito: só código do
 * servidor chama isto, nunca o navegador diretamente.
 */
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documentos-privados";

function storageConfigurado(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Mantido com o nome antigo (blobConfigurado) — só o backend de armazenamento mudou, não quem chama. */
export { storageConfigurado as blobConfigurado };

function obterCliente() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local — veja .env.example.");
  }
  return createClient(url, chave, { auth: { persistSession: false } });
}

/**
 * Sobe um arquivo para o bucket privado. O "url" devolvido não é uma URL
 * pública de verdade — é o caminho do objeto dentro do bucket, guardado como
 * está no banco (mesma coluna que antes guardava a URL do Vercel Blob).
 * Baixar sempre passa por baixarArquivoPrivado, nunca por um link direto.
 */
export async function subirArquivoPrivado(pasta: string, nomeOriginal: string, arquivo: Blob): Promise<{ url: string; nome: string }> {
  const extensao = nomeOriginal.includes(".") ? nomeOriginal.slice(nomeOriginal.lastIndexOf(".")) : "";
  const caminho = `${pasta}/${crypto.randomUUID()}${extensao}`;
  const { error } = await obterCliente()
    .storage.from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
  if (error) throw new Error(`Falha ao subir o arquivo para o Supabase Storage: ${error.message}`);
  return { url: caminho, nome: nomeOriginal };
}

/** Busca os bytes de um arquivo privado do bucket, pelo caminho guardado no banco. */
export async function baixarArquivoPrivado(caminho: string): Promise<Response> {
  const { data, error } = await obterCliente().storage.from(BUCKET).download(caminho);
  if (error || !data) return new Response(null, { status: 502 });
  return new Response(data, { status: 200, headers: { "Content-Type": data.type || "application/octet-stream" } });
}
