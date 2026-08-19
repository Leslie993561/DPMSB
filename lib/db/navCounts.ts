import "server-only";
import { listarColaboradores } from "./colaboradores";
import { listarPeriodosAbertos } from "./periodosAquisitivos";

export interface NavCounts {
  colaboradores: number;
  feriasEmAberto: number;
  folha: number;
}

/** Contagens exibidas como badge nos itens da sidebar — sempre derivadas do banco, nunca fixas. */
export async function obterNavCounts(): Promise<NavCounts> {
  const colaboradores = await listarColaboradores();
  return {
    colaboradores: colaboradores.length,
    feriasEmAberto: (await listarPeriodosAbertos()).length,
    folha: colaboradores.length,
  };
}
