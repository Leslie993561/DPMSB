import { getLegalTable } from "../legal-tables";
import { arredondar, type CalculoResult } from "./types";

/** Calcula o depósito de FGTS (8% sobre a remuneração) devido no mês. */
export function calcularFGTS(salarioBase: number, competencia: Date): CalculoResult {
  const tabela = getLegalTable(competencia);
  const valor = arredondar(salarioBase * tabela.fgts.aliquota);

  return {
    valor,
    memoriaCalculo: [
      {
        label: `FGTS (${(tabela.fgts.aliquota * 100).toFixed(0)}% sobre a remuneração)`,
        formula: `R$ ${salarioBase.toFixed(2)} × ${(tabela.fgts.aliquota * 100).toFixed(0)}%`,
        valor,
      },
    ],
    tabelaLegalVersao: tabela.fonte,
    detalhe: {},
  };
}
