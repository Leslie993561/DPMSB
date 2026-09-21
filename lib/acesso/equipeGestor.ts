import "server-only";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarColaboradores } from "@/lib/db/colaboradores";
import { idsDaEquipe } from "@/lib/db/acessoGestores";

/**
 * `null` = sem restrição (administrador — vê todo mundo). Um `Set` = só esses
 * `colaboradores.id` — a própria equipe de um gestor no Quadro de
 * Colaboradores. Conjunto vazio (nunca `null`) quando não dá pra saber quem é
 * o gestor, pra falhar fechado em vez de mostrar tudo por engano.
 */
export async function escopoColaboradoresDoGestor(): Promise<Set<number> | null> {
  const sessao = await obterSessaoAtual();
  if (!sessao) return new Set();
  if (sessao.tipo === "administrador") return null;
  if (!sessao.colaboradorId) return new Set();

  const todos = await listarColaboradores();
  return idsDaEquipe(sessao.colaboradorId, todos);
}

/** Atalho pras rotas de UM colaborador específico (`/api/colaboradores/[id]/...`): admin sempre pode, gestor só na própria equipe. */
export async function dentroDoEscopo(colaboradorId: number): Promise<boolean> {
  const escopo = await escopoColaboradoresDoGestor();
  return escopo === null || escopo.has(colaboradorId);
}
