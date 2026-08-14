import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

/**
 * Tarifa de ônibus (ida ou volta) por cidade — dado municipal/operacional,
 * não uma tabela legal federal. Usada apenas como PALPITE inicial quando o
 * colaborador ainda não tem um valor de VT próprio cadastrado; o valor
 * informado no cadastro (por dia útil) sempre prevalece sobre esta tabela.
 */
export const TARIFA_VT_POR_CIDADE: Record<string, number> = {
  "Lauro de Freitas": 10.4,
  Salvador: 11.9,
  Camaçari: 18,
  "Simões Filho": 10.4,
};

/** Percentual máximo que pode ser descontado do salário do empregado (Lei 7.418/85, art. 4º, c/c Decreto 95.247/87). */
const PERCENTUAL_MAXIMO_DESCONTO = 0.06;

/** Normaliza (maiúsculas, sem acento, sem espaço nas pontas) para casar "CAMACARI"/"Camaçari"/"camaçari" com a mesma chave. */
function normalizarCidade(cidade: string): string {
  return cidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

const TARIFA_VT_POR_CIDADE_NORMALIZADA: Record<string, number> = Object.fromEntries(
  Object.entries(TARIFA_VT_POR_CIDADE).map(([cidade, tarifa]) => [normalizarCidade(cidade), tarifa]),
);

/** Tarifa-padrão da cidade (placeholder) — só usada quando o colaborador não tem valor de VT próprio cadastrado. */
export function tarifaVtPorCidade(cidade: string): number {
  return TARIFA_VT_POR_CIDADE_NORMALIZADA[normalizarCidade(cidade)] ?? 0;
}

export interface DetalheValeTransporte {
  tarifaUnitaria: number;
  diasUteis: number;
  valorBruto: number;
  descontoEmpregado: number;
  custoEmpresa: number;
}

/**
 * Custo do vale-transporte: 2 trechos (ida/volta) × tarifa por dia útil ×
 * dias úteis no mês, menos o desconto do empregado (até 6% do salário base —
 * Lei 7.418/85). O custo para a empresa é sempre o valor bruto menos esse
 * desconto — nunca um número arbitrado à mão. `tarifaUnitaria` é o valor de
 * UM trecho (ida OU volta) num dia útil, tipicamente o valor de VT cadastrado
 * para o colaborador.
 */
export function calcularValeTransporte(
  tarifaUnitaria: number,
  salarioBase: number,
  diasUteis: number,
): CalculoResult<DetalheValeTransporte> {
  const valorBruto = arredondar(tarifaUnitaria * 2 * diasUteis);
  const descontoEmpregado = arredondar(Math.min(salarioBase * PERCENTUAL_MAXIMO_DESCONTO, valorBruto));
  const custoEmpresa = arredondar(valorBruto - descontoEmpregado);

  const memoriaCalculo: MemoriaCalculoStep[] = [
    {
      label: "Vale-transporte bruto",
      formula: `R$ ${tarifaUnitaria.toFixed(2)} × 2 trechos × ${diasUteis} dias úteis`,
      valor: valorBruto,
    },
    {
      label: "Desconto do empregado (até 6% do salário, Lei 7.418/85)",
      formula: `mín(R$ ${salarioBase.toFixed(2)} × 6%, valor bruto)`,
      valor: descontoEmpregado,
    },
    { label: "Custo líquido para a empresa", valor: custoEmpresa },
  ];

  return {
    valor: custoEmpresa,
    memoriaCalculo,
    tabelaLegalVersao: "Lei 7.418/85 (desconto do empregado)",
    detalhe: { tarifaUnitaria, diasUteis, valorBruto, descontoEmpregado, custoEmpresa },
  };
}
