import { getLegalTable } from "../legal-tables";
import { arredondar } from "./types";

export interface AdicionaisInput {
  salarioBase: number;
  /** Percentual de periculosidade (30 = 30%); null quando não recebe. */
  periculosidadePercentual: number | null;
  /** Percentual de insalubridade (10, 20 ou 40); null quando não recebe. */
  insalubridadePercentual: number | null;
  /** Valor em reais de um adicional que não segue percentual. */
  adicionalFixo: number | null;
}

export interface ResultadoAdicionais {
  periculosidade: number;
  insalubridade: number;
  adicionalFixo: number;
  total: number;
}

/**
 * Adicionais de salário sobre bases DIFERENTES, e é essa a pegadinha:
 * periculosidade incide sobre o salário base (Art. 193 §1º CLT) e
 * insalubridade sobre o salário mínimo (Art. 192), não sobre o salário da
 * pessoa. Calcular as duas sobre a mesma base é o erro clássico aqui.
 *
 * Periculosidade e insalubridade não se acumulam (Art. 193 §2º): o empregado
 * opta por uma. O cálculo NÃO decide por ele — se as duas vierem preenchidas,
 * as duas entram, porque inventar a opção do empregado seria pior do que
 * mostrar um valor que o DP reconhece como errado e vai corrigir no cadastro.
 */
export function calcularAdicionais(input: AdicionaisInput, competencia: Date): ResultadoAdicionais {
  const { salarioMinimo } = getLegalTable(competencia);

  const periculosidade = input.periculosidadePercentual
    ? arredondar(input.salarioBase * (input.periculosidadePercentual / 100))
    : 0;
  const insalubridade = input.insalubridadePercentual
    ? arredondar(salarioMinimo * (input.insalubridadePercentual / 100))
    : 0;
  const adicionalFixo = input.adicionalFixo ?? 0;

  return {
    periculosidade,
    insalubridade,
    adicionalFixo,
    total: arredondar(periculosidade + insalubridade + adicionalFixo),
  };
}
