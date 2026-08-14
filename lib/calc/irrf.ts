import { getLegalTable } from "../legal-tables";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";
import type { FaixaIRRF } from "../legal-tables/types";

export interface DetalheIRRF {
  aliquotaMarginal: number;
  faixaAplicada: FaixaIRRF;
  baseCalculoFinal: number;
}

/**
 * Calcula o IRRF retido na fonte sobre um rendimento tributável (já líquido de
 * INSS), aplicando dedução por dependente e, opcionalmente, pensão alimentícia.
 */
export function calcularIRRF(
  rendimentoTributavel: number,
  dependentes: number,
  competencia: Date,
  pensaoAlimenticia = 0,
): CalculoResult<DetalheIRRF> {
  const tabela = getLegalTable(competencia);
  const { faixas, deducaoPorDependente } = tabela.irrf;

  const memoriaCalculo: MemoriaCalculoStep[] = [
    {
      label: "Rendimento tributável (após INSS)",
      valor: arredondar(rendimentoTributavel),
    },
  ];

  const deducaoDependentes = arredondar(dependentes * deducaoPorDependente);
  if (dependentes > 0) {
    memoriaCalculo.push({
      label: `Dedução por dependentes (${dependentes} × R$ ${deducaoPorDependente.toFixed(2)})`,
      valor: deducaoDependentes,
    });
  }
  if (pensaoAlimenticia > 0) {
    memoriaCalculo.push({ label: "Dedução de pensão alimentícia", valor: arredondar(pensaoAlimenticia) });
  }

  const baseCalculoFinal = Math.max(
    0,
    arredondar(rendimentoTributavel - deducaoDependentes - pensaoAlimenticia),
  );
  memoriaCalculo.push({ label: "Base de cálculo do IRRF", valor: baseCalculoFinal });

  const faixaAplicada = faixas.find((f) => baseCalculoFinal <= f.ate) ?? faixas[faixas.length - 1];

  const valorBruto = baseCalculoFinal * faixaAplicada.aliquota - faixaAplicada.deducao;
  const valor = arredondar(Math.max(0, valorBruto));

  memoriaCalculo.push({
    label: `IRRF (alíquota ${(faixaAplicada.aliquota * 100).toFixed(1)}%, dedução R$ ${faixaAplicada.deducao.toFixed(2)})`,
    formula: `R$ ${baseCalculoFinal.toFixed(2)} × ${(faixaAplicada.aliquota * 100).toFixed(1)}% − R$ ${faixaAplicada.deducao.toFixed(2)}`,
    valor,
  });

  return {
    valor,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      aliquotaMarginal: faixaAplicada.aliquota,
      faixaAplicada,
      baseCalculoFinal,
    },
  };
}
