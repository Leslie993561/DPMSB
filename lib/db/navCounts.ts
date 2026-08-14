import "server-only";
import { listarColaboradores } from "./colaboradores";
import { listarPeriodosAbertos } from "./periodosAquisitivos";

export interface NavCounts {
  colaboradores: number;
  feriasEmAberto: number;
  folha: number;
}

/** Contagens exibidas como badge nos itens da sidebar — sempre derivadas do banco, nunca fixas. */
export function obterNavCounts(): NavCounts {
  const colaboradores = listarColaboradores();
  return {
    colaboradores: colaboradores.length,
    feriasEmAberto: listarPeriodosAbertos().length,
    folha: colaboradores.length,
  };
}
