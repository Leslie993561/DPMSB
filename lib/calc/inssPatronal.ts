import { getLegalTable } from "../legal-tables";
import { arredondar, type CalculoResult } from "./types";

/** Calcula a contribuição previdenciária patronal básica (20% sobre a folha, Lei 8.212/91 art. 22, I). */
export function calcularInssPatronal(baseFolha: number, competencia: Date): CalculoResult {
  const tabela = getLegalTable(competencia);
  const valor = arredondar(baseFolha * tabela.inssPatronal.aliquota);

  return {
    valor,
    memoriaCalculo: [
      {
        label: `INSS patronal (${(tabela.inssPatronal.aliquota * 100).toFixed(0)}% sobre a folha)`,
        formula: `R$ ${baseFolha.toFixed(2)} × ${(tabela.inssPatronal.aliquota * 100).toFixed(0)}%`,
        valor,
      },
    ],
    tabelaLegalVersao: tabela.fonte,
    detalhe: {},
  };
}
