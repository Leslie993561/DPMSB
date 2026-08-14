import { getLegalTable } from "../legal-tables";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export interface FaixaAplicadaINSS {
  ate: number;
  aliquota: number;
  baseFaixa: number;
  contribuicao: number;
}

export interface DetalheINSS {
  aliquotaEfetiva: number;
  faixasAplicadas: FaixaAplicadaINSS[];
  baseConsiderada: number;
}

/**
 * Calcula a contribuição previdenciária (INSS) do empregado de forma progressiva
 * por faixas (não uma alíquota única sobre o total), respeitando o teto de
 * contribuição vigente na competência informada.
 */
export function calcularINSS(
  salarioBruto: number,
  competencia: Date,
): CalculoResult<DetalheINSS> {
  const tabela = getLegalTable(competencia);
  const { faixas, tetoContribuicao } = tabela.inss;

  const baseConsiderada = Math.min(Math.max(salarioBruto, 0), tetoContribuicao);

  let anterior = 0;
  let total = 0;
  const faixasAplicadas: FaixaAplicadaINSS[] = [];
  const memoriaCalculo: MemoriaCalculoStep[] = [];

  for (const faixa of faixas) {
    if (baseConsiderada <= anterior) break;
    const limiteFaixa = Math.min(baseConsiderada, faixa.ate);
    const baseFaixa = limiteFaixa - anterior;
    if (baseFaixa > 0) {
      const contribuicao = arredondar(baseFaixa * faixa.aliquota);
      total += contribuicao;
      faixasAplicadas.push({
        ate: faixa.ate,
        aliquota: faixa.aliquota,
        baseFaixa: arredondar(baseFaixa),
        contribuicao,
      });
      memoriaCalculo.push({
        label: `Faixa até R$ ${faixa.ate.toFixed(2)} (${(faixa.aliquota * 100).toFixed(1)}%)`,
        formula: `R$ ${baseFaixa.toFixed(2)} × ${(faixa.aliquota * 100).toFixed(1)}%`,
        valor: contribuicao,
      });
    }
    anterior = faixa.ate;
  }

  const valor = arredondar(total);
  if (salarioBruto > tetoContribuicao) {
    memoriaCalculo.push({
      label: "Teto de contribuição aplicado",
      formula: `Base limitada a R$ ${tetoContribuicao.toFixed(2)}`,
      valor,
    });
  }

  return {
    valor,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      aliquotaEfetiva: baseConsiderada > 0 ? arredondar((valor / baseConsiderada) * 100) : 0,
      faixasAplicadas,
      baseConsiderada,
    },
  };
}
