import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase do NAVEGADOR — só para subir arquivo direto numa URL
 * assinada (ver criarUrlUploadDireto em lib/storage.ts). Nunca usa a service
 * role key (fica só no servidor); a chave pública (anon) aqui não dá acesso a
 * nada por si só, o token da própria URL assinada é quem autoriza o upload.
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no
 * .env.local/Vercel — os dois são valores públicos (o painel do Supabase os
 * expõe assim de propósito), em Project Settings > API.
 */
export async function subirArquivoDireto(
  upload: { bucket: string; caminho: string; token: string },
  arquivo: File,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "Upload direto não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  const supabase = createClient(url, chave);
  const { error } = await supabase.storage.from(upload.bucket).uploadToSignedUrl(upload.caminho, upload.token, arquivo);
  if (error) throw new Error(`Falha ao subir o arquivo: ${error.message}`);
}
