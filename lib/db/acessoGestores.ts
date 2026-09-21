import "server-only";
import { getDb } from "./client";
import { todasAsChaves } from "@/lib/acesso/modulos";

export type StatusGestorAcesso = "ativo" | "inativo";

export interface GestorAcesso {
  id: number;
  colaboradorId: number | null;
  nome: string;
  email: string;
  status: StatusGestorAcesso;
  criadoEm: string;
}

interface LinhaGestorAcesso {
  id: number;
  colaborador_id: number | null;
  nome: string;
  email: string;
  status: StatusGestorAcesso;
  criado_em: string;
}

function paraGestorAcesso(linha: LinhaGestorAcesso): GestorAcesso {
  return {
    id: linha.id,
    colaboradorId: linha.colaborador_id,
    nome: linha.nome,
    email: linha.email,
    status: linha.status,
    criadoEm: linha.criado_em,
  };
}

export async function listarGestoresAcesso(): Promise<GestorAcesso[]> {
  const db = await getDb();
  const resultado = await db.execute("SELECT * FROM gestores_acesso ORDER BY nome");
  return (resultado.rows as unknown as LinhaGestorAcesso[]).map(paraGestorAcesso);
}

export class ErroValidacaoGestor extends Error {}

/**
 * "Papel de gestor" aqui é objetivo, não um cargo digitado: é quem já
 * aparece como `gestor_id` de pelo menos um colaborador no cadastro — a
 * mesma relação que o módulo de Colaboradores usa pra montar o organograma.
 */
async function buscarColaboradorGestorPorEmail(email: string): Promise<{ id: number; nome: string; email: string }> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT id, nome, email FROM colaboradores WHERE lower(email) = lower(?) LIMIT 1",
    args: [email],
  });
  const colaborador = resultado.rows[0] as unknown as { id: number; nome: string; email: string } | undefined;
  if (!colaborador) {
    throw new ErroValidacaoGestor(`Nenhum colaborador cadastrado com o e-mail "${email}".`);
  }

  const ehGestor = await db.execute({
    sql: "SELECT 1 FROM colaboradores WHERE gestor_id = ? LIMIT 1",
    args: [colaborador.id],
  });
  if (ehGestor.rows.length === 0) {
    throw new ErroValidacaoGestor(
      `"${colaborador.nome}" não é gestor de ninguém no cadastro — só gestores podem receber acesso ao portal.`,
    );
  }
  return colaborador;
}

export async function criarGestorAcesso(dados: { nome: string; email: string }): Promise<GestorAcesso> {
  const email = dados.email.trim().toLowerCase();
  const colaborador = await buscarColaboradorGestorPorEmail(email);

  const db = await getDb();
  const existente = await db.execute({
    sql: "SELECT id FROM gestores_acesso WHERE lower(email) = lower(?)",
    args: [email],
  });
  if (existente.rows.length > 0) {
    throw new ErroValidacaoGestor(`"${email}" já está cadastrado no controle de acesso.`);
  }

  const resultado = await db.execute({
    sql: `INSERT INTO gestores_acesso (colaborador_id, nome, email) VALUES (?, ?, ?) RETURNING *`,
    args: [colaborador.id, dados.nome.trim(), email],
  });
  return paraGestorAcesso(resultado.rows[0] as unknown as LinhaGestorAcesso);
}

export async function atualizarStatusGestorAcesso(
  id: number,
  status: StatusGestorAcesso,
): Promise<GestorAcesso | null> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "UPDATE gestores_acesso SET status = ? WHERE id = ? RETURNING *",
    args: [status, id],
  });
  const linha = resultado.rows[0] as unknown as LinhaGestorAcesso | undefined;
  return linha ? paraGestorAcesso(linha) : null;
}

export async function listarPermissoesGestor(gestorId: number): Promise<string[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT modulo FROM gestor_permissoes WHERE gestor_id = ?",
    args: [gestorId],
  });
  return (resultado.rows as unknown as { modulo: string }[]).map((r) => r.modulo);
}

/**
 * Substitui de uma vez o conjunto de módulos liberados do gestor pelo que
 * veio da tela (cada toggle manda o estado final da árvore inteira) — mais
 * simples e mais seguro que sincronizar toggle a toggle: não há como a UI e o
 * banco divergirem por uma chamada perdida no meio do caminho.
 */
export async function definirPermissoesGestor(gestorId: number, liberados: string[]): Promise<string[]> {
  const validas = new Set(todasAsChaves());
  const chaves = [...new Set(liberados)].filter((chave) => validas.has(chave));

  const db = await getDb();
  const comandos: { sql: string; args?: unknown[] }[] = [
    { sql: "DELETE FROM gestor_permissoes WHERE gestor_id = ?", args: [gestorId] },
    ...chaves.map((modulo) => ({
      sql: "INSERT INTO gestor_permissoes (gestor_id, modulo) VALUES (?, ?)",
      args: [gestorId, modulo],
    })),
  ];
  await db.batch(comandos);
  return chaves;
}
