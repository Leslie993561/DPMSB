import "server-only";
import { cookies } from "next/headers";
import { assinarSessao, verificarSessao, type SessaoPayload } from "./token";

export const NOME_COOKIE = "portaldp_sessao";
/** 8h — uma jornada de trabalho. Depois disso o gestor loga de novo e pega permissões atualizadas. */
const DURACAO_SEGUNDOS = 8 * 60 * 60;

function segredo(): string {
  const valor = process.env.AUTH_SECRET;
  if (!valor) throw new Error("Defina AUTH_SECRET no .env.local para habilitar o login.");
  return valor;
}

export async function criarTokenSessao(dados: Omit<SessaoPayload, "exp">): Promise<string> {
  const payload: SessaoPayload = { ...dados, exp: Math.floor(Date.now() / 1000) + DURACAO_SEGUNDOS };
  return assinarSessao(payload, segredo());
}

export async function definirCookieSessao(token: string): Promise<void> {
  const store = await cookies();
  store.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
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
