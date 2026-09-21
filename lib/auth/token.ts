/**
 * Token de sessão assinado (HMAC-SHA256), sem estado no servidor: as
 * permissões do gestor vêm gravadas dentro do próprio cookie, não do banco.
 * Isso evita uma consulta a cada requisição — o Proxy roda em TODA página e
 * TODA rota de API, e o pooler do Supabase já aceita só 15 conexões (ver
 * `lib/db/client.ts`). O preço: mudar a permissão de alguém só vale no
 * próximo login, não em tempo real — mesma troca que a especificação deixou
 * em aberto pra decidir.
 *
 * Usa Web Crypto (`crypto.subtle`), disponível tanto no runtime Node quanto
 * no Edge, para o mesmo código valer no Proxy e nas rotas de API.
 */

export type TipoSessao = "administrador" | "gestor";

export interface SessaoPayload {
  email: string;
  nome: string;
  cargo: string | null;
  tipo: TipoSessao;
  gestorId: number | null;
  /** Chaves de módulo liberadas (vazio para administrador, que não precisa). */
  liberados: string[];
  /** Expiração, em segundos desde epoch. */
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function paraBase64Url(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(valor: string): Uint8Array {
  const normalizado = valor.replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = normalizado.padEnd(normalizado.length + ((4 - (normalizado.length % 4)) % 4), "=");
  const binario = atob(preenchido);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function chaveHmac(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function assinarSessao(payload: SessaoPayload, segredo: string): Promise<string> {
  const corpo = paraBase64Url(encoder.encode(JSON.stringify(payload)));
  const chave = await chaveHmac(segredo);
  const assinatura = await crypto.subtle.sign("HMAC", chave, encoder.encode(corpo));
  return `${corpo}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

export async function verificarSessao(token: string, segredo: string): Promise<SessaoPayload | null> {
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;

  try {
    const chave = await chaveHmac(segredo);
    const valido = await crypto.subtle.verify(
      "HMAC",
      chave,
      deBase64Url(assinatura) as BufferSource,
      encoder.encode(corpo) as BufferSource,
    );
    if (!valido) return null;

    const payload = JSON.parse(decoder.decode(deBase64Url(corpo))) as SessaoPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
