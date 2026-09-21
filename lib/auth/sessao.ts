import "server-only";
import { cookies } from "next/headers";
import { assinarSessao, verificarSessao, type SessaoPayload, type TipoSessao } from "./token";

export const NOME_COOKIE = "portaldp_sessao";
/** Gestor: 8h, uma jornada — depois disso loga de novo e pega permissões atualizadas. */
const DURACAO_GESTOR_SEGUNDOS = 8 * 60 * 60;
/** Administrador (dona do portal): 180 dias — não faz sentido pedir e-mail dela toda hora. */
const DURACAO_ADMIN_SEGUNDOS = 180 * 24 * 60 * 60;

function duracaoPara(tipo: TipoSessao): number {
  return tipo === "administrador" ? DURACAO_ADMIN_SEGUNDOS : DURACAO_GESTOR_SEGUNDOS;
}

function segredo(): string {
  const valor = process.env.AUTH_SECRET;
  if (!valor) throw new Error("Defina AUTH_SECRET no .env.local para habilitar o login.");
  return valor;
}

export async function criarTokenSessao(
  dados: Omit<SessaoPayload, "exp">,
): Promise<{ token: string; duracaoSegundos: number }> {
  const duracaoSegundos = duracaoPara(dados.tipo);
  const payload: SessaoPayload = { ...dados, exp: Math.floor(Date.now() / 1000) + duracaoSegundos };
  const token = await assinarSessao(payload, segredo());
  return { token, duracaoSegundos };
}

export async function definirCookieSessao(token: string, duracaoSegundos: number): Promise<void> {
  const store = await cookies();
  store.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: duracaoSegundos,
  });
}

export async function limparCookieSessao(): Promise<void> {
  const store = await cookies();
  store.delete(NOME_COOKIE);
}

export async function obterSessaoAtual(): Promise<SessaoPayload | null> {
  const store = await cookies();
  const token = store.get(NOME_COOKIE)?.value;
  if (!token) return null;
  return verificarSessao(token, segredo());
}
