import "server-only";
import { getDb } from "./client";
import { todasAsChaves } from "@/lib/acesso/modulos";
import { nomeReduzido } from "@/lib/folha/casarNome";
import { listarColaboradores, type Colaborador } from "./colaboradores";

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

/** Usado no login: confere se o e-mail está cadastrado e ativo antes de abrir sessão. */
export async function buscarGestorAcessoPorEmail(email: string): Promise<GestorAcesso | null> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM gestores_acesso WHERE lower(email) = lower(?)",
    args: [email.trim()],
  });
  const linha = resultado.rows[0] as unknown as LinhaGestorAcesso | undefined;
  return linha ? paraGestorAcesso(linha) : null;
}

export class ErroValidacaoGestor extends Error {}

/** Palavras do nome, sem acento/conectivo/pontuação — pra casar "Fabiana Sousa" com "Fabiana Santos Sousa". */
function palavrasDoNome(nome: string): Set<string> {
  return new Set(nomeReduzido(nome).split(" ").filter(Boolean));
}

/**
 * O líder direto de UM colaborador: `gestor_id` (FK) quando existe, senão
 * `lider_direto_nome` (texto livre, curto: "Fabiana Sousa") casado por
 * SUBCONJUNTO de palavras contra o nome completo de todo mundo — toda
 * palavra do nome curto precisa aparecer no nome completo. Se mais de um
 * colaborador bater com o mesmo nome curto, ninguém é escolhido — mesma
 * regra de `casarPorNome` (lib/folha/casarNome.ts): errar quem é o líder é
 * pior que deixar de fora.
 */
function resolverLiderDireto(colaborador: Colaborador, todos: Colaborador[]): number | null {
  if (colaborador.gestorId !== null) return colaborador.gestorId;
  const nomeLider = colaborador.liderDiretoNome?.trim();
  if (!nomeLider) return null;

  const alvo = palavrasDoNome(nomeLider);
  if (alvo.size === 0) return null;
  const achados = todos.filter((c) => {
    const doNome = palavrasDoNome(c.nome);
    return [...alvo].every((palavra) => doNome.has(palavra));
  });
  return achados.length === 1 ? achados[0].id : null;
}

/** Quem conta como "gestor" pro controle de acesso: é líder direto de pelo menos um colaborador. */
export async function listarColaboradoresGestores(colaboradores?: Colaborador[]): Promise<Colaborador[]> {
  const todos = colaboradores ?? (await listarColaboradores());
  const idsGestores = new Set(
    todos.map((c) => resolverLiderDireto(c, todos)).filter((id): id is number => id !== null),
  );
  return todos.filter((c) => idsGestores.has(c.id));
}

/**
 * IDs de quem é liderado diretamente por `gestorColaboradorId` — usado para
 * restringir o Quadro de Colaboradores a "minha equipe" quando quem está
 * logado é gestor, não administrador.
 */
export function idsDaEquipe(gestorColaboradorId: number, todos: Colaborador[]): Set<number> {
  const ids = new Set<number>();
  for (const c of todos) {
    if (resolverLiderDireto(c, todos) === gestorColaboradorId) ids.add(c.id);
  }
  return ids;
}

export interface CandidatoGestor {
  id: number;
  nome: string;
  email: string;
  cargo: string | null;
}

/** Quem pode ser adicionado à lista de acesso agora: é gestor E ainda não está cadastrado. */
export async function listarCandidatosGestor(): Promise<CandidatoGestor[]> {
  const [gestores, jaCadastrados] = await Promise.all([listarColaboradoresGestores(), listarGestoresAcesso()]);
  const emailsCadastrados = new Set(jaCadastrados.map((g) => g.email.toLowerCase()));

  return gestores
    .filter((c) => c.email && !emailsCadastrados.has(c.email.toLowerCase()))
    .map((c) => ({ id: c.id, nome: c.nome, email: c.email as string, cargo: c.cargo }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

async function buscarColaboradorGestorPorEmail(email: string): Promise<{ id: number; nome: string; email: string }> {
  const todos = await listarColaboradores();
  const gestores = await listarColaboradoresGestores(todos);
  const colaborador = gestores.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  if (colaborador) return { id: colaborador.id, nome: colaborador.nome, email: colaborador.email as string };

  const existe = todos.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  if (existe) {
    throw new ErroValidacaoGestor(
      `"${existe.nome}" não é gestor de ninguém no cadastro — só gestores podem receber acesso ao portal.`,
    );
  }
  throw new ErroValidacaoGestor(`Nenhum colaborador cadastrado com o e-mail "${email}".`);
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
