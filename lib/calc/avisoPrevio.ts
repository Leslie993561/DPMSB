import type { MemoriaCalculoStep } from "./types";

export interface AvisoPrevioResult {
  dias: number;
  memoriaCalculo: MemoriaCalculoStep[];
}

const DIAS_BASE = 30;
const DIAS_POR_ANO_COMPLETO = 3;
const DIAS_MAXIMO = 90;

/**
 * Aviso prévio proporcional ao tempo de serviço (Lei 12.506/2011):
 * 30 dias base + 3 dias por ano completo de serviço, limitado a 90 dias.
 */
export function calcularAvisoPrevio(mesesTrabalhados: number): AvisoPrevioResult {
  const anosCompletos = Math.floor(Math.max(0, mesesTrabalhados) / 12);
  const diasAdicionais = Math.min(anosCompletos * DIAS_POR_ANO_COMPLETO, DIAS_MAXIMO - DIAS_BASE);
  const dias = DIAS_BASE + diasAdicionais;

  return {
    dias,
    memoriaCalculo: [
      { label: "Aviso prévio base (Lei 12.506/2011)", valor: DIAS_BASE },
      {
        label: `Dias adicionais (${anosCompletos} ano(s) completo(s) × ${DIAS_POR_ANO_COMPLETO} dias, limitado a ${DIAS_MAXIMO} dias no total)`,
        valor: diasAdicionais,
      },
      { label: "Total de dias de aviso prévio", valor: dias },
    ],
  };
}
