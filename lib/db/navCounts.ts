import "server-only";
import { listarColaboradores } from "./colaboradores";
import { listarPeriodosAbertos } from "./periodosAquisitivos";

export interface NavCounts {
  colaboradores: number;
  feriasEmAberto: number;
  folha: number;
}

/**
 * Contagens exibidas como badge nos itens da sidebar — sempre derivadas do
 * banco, nunca fixas. Só conta ATIVO (desligado não é força de trabalho
 * corrente, nem em Colaboradores nem em Breakdown de Folha — os dois badges
 * usavam o mesmo total incluindo quem já saiu).
 *
 * `escopoGestor`: quando quem está logado é gestor, os badges mostram só a
 * própria equipe, do mesmo jeito que o Quadro de Colaboradores e o Controle
 * de Férias já mostram — `null`/ausente (administrador) não restringe.
 */
export async function obterNavCounts(escopoGestor?: Set<number> | null): Promise<NavCounts> {
  const todos = await listarColaboradores();
  const ativos = todos.filter((c) => c.status !== "desligado" && (!escopoGestor || escopoGestor.has(c.id)));

  const periodos = await listarPeriodosAbertos();
  const feriasEmAberto = escopoGestor ? periodos.filter((p) => escopoGestor.has(p.colaboradorId)).length : periodos.length;

  return {
    colaboradores: ativos.length,
    feriasEmAberto,
    folha: ativos.length,
  };
}
