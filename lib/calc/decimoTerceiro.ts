import { getLegalTable } from "../legal-tables";
import { calcularINSS } from "./inss";
import { calcularIRRF } from "./irrf";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export interface DetalheDecimoTerceiro {
  valorBruto: number;
  inss: number;
  irrf: number;
  adiantamentoRecebido: number;
  valorLiquido: number;
}

/**
 * 13º salário proporcional. `mesesTrabalhadosNoAno` deve já refletir a regra de
 * que uma fração ≥ 15 dias em um mês conta como mês completo (calcule isso
 * antes de chamar esta função).
 */
export function calcularDecimoTerceiro(
  salarioBase: number,
  mesesTrabalhadosNoAno: number,
  dependentes: number,
  adiantamentoRecebido: number,
  competencia: Date,
): CalculoResult<DetalheDecimoTerceiro> {
  const tabela = getLegalTable(competencia);
  const meses = Math.min(12, Math.max(0, mesesTrabalhadosNoAno));

  const valorBruto = arredondar((salarioBase / 12) * meses);

  const memoriaCalculo: MemoriaCalculoStep[] = [
    {
      label: `13º proporcional (${meses}/12 avos)`,
      formula: `R$ ${salarioBase.toFixed(2)} ÷ 12 × ${meses}`,
      valor: valorBruto,
    },
  ];

  const inss = calcularINSS(valorBruto, competencia);
  memoriaCalculo.push({ label: "INSS sobre o 13º", valor: inss.valor });

  const irrf = calcularIRRF(valorBruto - inss.valor, dependentes, competencia);
  memoriaCalculo.push({ label: "IRRF sobre o 13º", valor: irrf.valor });

  if (adiantamentoRecebido > 0) {
    memoriaCalculo.push({ label: "Adiantamento já recebido", valor: arredondar(adiantamentoRecebido) });
  }

  const valorLiquido = arredondar(valorBruto - inss.valor - irrf.valor - adiantamentoRecebido);
  memoriaCalculo.push({ label: "13º líquido a receber", valor: valorLiquido });

  return {
    valor: valorLiquido,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      valorBruto,
      inss: inss.valor,
      irrf: irrf.valor,
      adiantamentoRecebido: arredondar(adiantamentoRecebido),
      valorLiquido,
    },
  };
}
