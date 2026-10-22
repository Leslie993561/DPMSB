import "server-only";
import { randomBytes } from "node:crypto";
import { getDb } from "./client";
import { emailConfigurado, enviarEmail } from "@/lib/email";

/** Validade do link de auto-cadastro. */
export const DURACAO_HORAS = 72;

export interface ConviteCadastro {
  id: number;
  /** null = convite de pré-cadastro: a pessoa ainda não existe no Quadro, ela cria o próprio registro ao submeter. */
  colaboradorId: number | null;
  email: string;
  token: string;
  criadoEm: string;
  expiraEm: string;
  abertoEm: string | null;
  usadoEm: string | null;
  /** 1ª etapa (dados pessoais) já enviada ao RH — o link volta direto para a etapa de documentos. */
  dadosEnviadosEm: string | null;
}

interface LinhaConvite {
  id: number;
  colaborador_id: number | null;
  email: string;
  token: string;
  criado_em: string;
  expira_em: string;
  aberto_em: string | null;
  usado_em: string | null;
  dados_enviados_em: string | null;
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
    dadosEnviadosEm: linha.dados_enviados_em,
  };
}

/** `colaboradorId: null` gera um convite de PRÉ-CADASTRO — sem ninguém existente pra vincular ainda. */
export async function criarConvite(colaboradorId: number | null, email: string): Promise<ConviteCadastro> {
  const token = randomBytes(24).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_HORAS * 60 * 60 * 1000).toISOString();

  const db = await getDb();
  const resultado = await db.execute({
    sql: `INSERT INTO convites_cadastro (colaborador_id, email, token, expira_em) VALUES (?, ?, ?, ?) RETURNING *`,
    args: [colaboradorId, email.trim().toLowerCase(), token, expiraEm],
  });
  return paraConvite(resultado.rows[0] as unknown as LinhaConvite);
}

/** Depois que o pré-cadastro cria o colaborador, vincula o convite a ele (auditoria/histórico). */
export async function vincularConviteAoColaborador(id: number, colaboradorId: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "UPDATE convites_cadastro SET colaborador_id = ? WHERE id = ?", args: [colaboradorId, id] });
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

/**
 * Pode ABRIR: não expirou e não foi finalizado. Com 72h e duas etapas, a
 * pessoa precisa poder voltar ao link (recarregar, anexar o resto depois).
 */
export function convitePodeAbrir(convite: ConviteCadastro): boolean {
  return !convite.usadoEm && new Date(convite.expiraEm).getTime() > Date.now();
}

/** Pode SUBMETER dados/documentos: mesma regra de abrir. */
export const convitePodeSubmeter = convitePodeAbrir;

export async function marcarConviteAberto(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE convites_cadastro SET aberto_em = ? WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}

export async function marcarDadosEnviados(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE convites_cadastro SET dados_enviados_em = COALESCE(dados_enviados_em, ?) WHERE id = ?",
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

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailConvite(para: string, link: string) {
  return {
    para,
    assunto: "Complete seu cadastro — Portal Recursos Humanos MSB",
    texto: `Olá!\n\nO RH da MSB gerou um link para você completar seu cadastro no Portal de Recursos Humanos.\n\nAcesse pelo link abaixo — válido por 72 horas:\n${link}\n\nRH · MSB`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2d3d;max-width:520px">
  <p>Olá!</p>
  <p>O RH da MSB gerou um link para você completar seu cadastro no Portal de Recursos Humanos.</p>
  <p style="margin:24px 0"><a href="${escaparHtml(link)}" style="background:#56a4bb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Completar cadastro</a></p>
  <p style="font-size:12px;color:#6b7c8f">Link válido por 72 horas. Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(link)}</p>
  <p>RH · MSB</p>
</div>`,
  };
}

/** RH clica em "Enviar" ao lado do link gerado — é aqui que o e-mail de fato sai. */
export async function enviarEmailConvite(
  token: string,
  origem: string,
): Promise<{ emailEnviadoPara: string | null; erroEmail: string | null }> {
  const convite = await buscarConvitePorToken(token);
  if (!convite) return { emailEnviadoPara: null, erroEmail: "Convite não encontrado." };
  if (!emailConfigurado()) {
    return { emailEnviadoPara: null, erroEmail: "Envio automático de e-mail ainda não configurado no portal." };
  }

  const link = `${origem}/convite/${convite.token}`;
  try {
    await enviarEmail(emailConvite(convite.email, link));
    return { emailEnviadoPara: convite.email, erroEmail: null };
  } catch (erro) {
    return {
      emailEnviadoPara: null,
      erroEmail: `Não foi possível enviar o e-mail (${erro instanceof Error ? erro.message : "erro desconhecido"}).`,
    };
  }
}
