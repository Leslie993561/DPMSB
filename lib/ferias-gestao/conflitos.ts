import type { LancamentoComContexto } from "@/lib/db/lancamentosFerias";

export interface Conflito {
  departamento: string;
  colaborador1: string;
  colaborador2: string;
  periodo1: string;
  periodo2: string;
}

/**
 * Duas pessoas do mesmo departamento com férias sobrepostas — usado tanto
 * pelos Alertas Inteligentes quanto pelo Planejamento trimestral, por isso
 * vive como função pura e testável aqui, não duplicada em cada tela.
 */
export function detectarConflitos(lancamentos: LancamentoComContexto[]): Conflito[] {
  const comData = lancamentos
    .filter(
      (l) =>
        l.lancamento.status === "programada" ||
        l.lancamento.status === "concluida" ||
        l.lancamento.status === "alterada",
    )
    .map((l) => {
      const inicio = l.lancamento.dataInicioGozo ?? l.lancamento.dataInicioPrevista;
      if (!inicio || !l.colaboradorDepartamento) return null;
      const dataInicio = new Date(inicio);
      const dataFim = new Date(dataInicio);
      dataFim.setDate(dataFim.getDate() + l.lancamento.dias - 1);
      return { ...l, dataInicio, dataFim };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const conflitos: Conflito[] = [];
  for (let i = 0; i < comData.length; i++) {
    for (let j = i + 1; j < comData.length; j++) {
      const a = comData[i];
      const b = comData[j];
      if (a.colaboradorDepartamento !== b.colaboradorDepartamento) continue;
      if (a.colaboradorNome === b.colaboradorNome) continue;
      const sobrepoe = a.dataInicio <= b.dataFim && b.dataInicio <= a.dataFim;
      if (sobrepoe) {
        conflitos.push({
          departamento: a.colaboradorDepartamento!,
          colaborador1: a.colaboradorNome,
          colaborador2: b.colaboradorNome,
          periodo1: `${a.dataInicio.toISOString().slice(0, 10)} a ${a.dataFim.toISOString().slice(0, 10)}`,
          periodo2: `${b.dataInicio.toISOString().slice(0, 10)} a ${b.dataFim.toISOString().slice(0, 10)}`,
        });
      }
    }
  }
  return conflitos;
}
