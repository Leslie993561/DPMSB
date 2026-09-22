import "server-only";
import { randomBytes } from "node:crypto";
import { getDb } from "./client";

const DURACAO_HORAS = 2;

export interface ConviteCadastro {
  id: number;
  colaboradorId: number;
  email: string;
  token: string;
  criadoEm: string;
  expiraEm: string;
  abertoEm: string | null;
  usadoEm: string | null;
}

interface LinhaConvite {
  id: number;
  colaborador_id: number;
  email: string;
  token: string;
  criado_em: string;
  expira_em: string;
  aberto_em: string | null;
  usado_em: string | null;
}

function paraConvite(linha: LinhaConvite): ConviteCadastro {
  return {
    id: linha.id,
    colaboradorId: linha.colaborador_id,
    email: linha.email,
    token: linha.token,
    criadoEm: linha.criado_em,
    expiraEm: linha.expira_em,
    abertoEm: linha.aberto_em,
    usadoEm: linha.usado_em,
  };
}

export async function criarConvite(colaboradorId: number, email: string): Promise<ConviteCadastro> {
  const token = randomBytes(24).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_HORAS * 60 * 60 * 1000).toISOString();

  const db = await getDb();
  const resultado = await db.execute({
    sql: `INSERT INTO convites_cadastro (colaborador_id, email, token, expira_em) VALUES (?, ?, ?, ?) RETURNING *`,
    args: [colaboradorId, email.trim().toLowerCase(), token, expiraEm],
  });
  return paraConvite(resultado.rows[0] as unknown as LinhaConvite);
}

export async function buscarConvitePorToken(token: string): Promise<ConviteCadastro | null> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM convites_cadastro WHERE token = ?",
    args: [token],
  });
  const linha = resultado.rows[0] as unknown as LinhaConvite | undefined;
  return linha ? paraConvite(linha) : null;
}

/** Pode ABRIR (primeira vez): não expirou, não foi aberto antes, não foi usado. */
export function convitePodeAbrir(convite: ConviteCadastro): boolean {
  return !convite.abertoEm && !convite.usadoEm && new Date(convite.expiraEm).getTime() > Date.now();
}

/** Pode SUBMETER: já foi aberto (pela própria abertura que trouxe o formulário), ainda não usado, não expirou. */
export function convitePodeSubmeter(convite: ConviteCadastro): boolean {
  return !convite.usadoEm && new Date(convite.expiraEm).getTime() > Date.now();
}

export async function marcarConviteAberto(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE convites_cadastro SET aberto_em = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}

export async function marcarConviteUsado(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE convites_cadastro SET usado_em = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}
