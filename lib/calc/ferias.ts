import { getLegalTable } from "../legal-tables";
import { calcularINSS } from "./inss";
import { calcularIRRF } from "./irrf";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export interface FeriasInput {
  salarioBase: number;
  /** Dias de direito no período aquisitivo (até 30). */
  diasDireito: number;
  /** Dias efetivamente gozados/pagos neste evento. */
  diasGozados: number;
  /** Venda de 1/3 do período de direito (Art. 143 CLT). */
  abonoPecuniario: boolean;
  dependentes: number;
  competencia: Date;
}

export interface DetalheFerias {
  valorGozado: number;
  tercoConstitucional: number;
  diasVendidos: number;
  abono: number;
  tercoAbono: number;
  inss: number;
  irrf: number;
  valorLiquido: number;
}

/**
 * Férias gozadas + 1/3 constitucional (tributáveis por INSS/IRRF) e, se houver,
 * abono pecuniário + seu 1/3 (natureza indenizatória, não tributável).
 */
export function calcularFerias(input: FeriasInput): CalculoResult<DetalheFerias> {
  const { salarioBase, diasDireito, diasGozados, abonoPecuniario, dependentes, competencia } = input;
  const tabela = getLegalTable(competencia);

  const valorDiario = salarioBase / 30;
  const valorGozado = arredondar(valorDiario * diasGozados);
  const tercoConstitucional = arredondar(valorGozado / 3);

  const memoriaCalculo: MemoriaCalculoStep[] = [
    { label: "Valor do dia de férias", formula: `R$ ${salarioBase.toFixed(2)} ÷ 30`, valor: arredondar(valorDiario) },
    { label: `Férias gozadas (${diasGozados} dias)`, valor: valorGozado },
    { label: "1/3 constitucional (Art. 7º, XVII CF)", formula: "valor gozado ÷ 3", valor: tercoConstitucional },
  ];

  let diasVendidos = 0;
  let abono = 0;
  let tercoAbono = 0;
  if (abonoPecuniario) {
    diasVendidos = arredondar(diasDireito / 3);
    abono = arredondar(valorDiario * diasVendidos);
    tercoAbono = arredondar(abono / 3);
    memoriaCalculo.push({
      label: `Abono pecuniário (venda de ${diasVendidos} dias)`,
      valor: abono,
    });
    memoriaCalculo.push({ label: "1/3 sobre o abono", valor: tercoAbono });
  }

  const baseTributavel = arredondar(valorGozado + tercoConstitucional);
  const inss = calcularINSS(baseTributavel, competencia);
  memoriaCalculo.push({ label: "INSS sobre férias + 1/3 (abono não é tributável)", valor: inss.valor });

  const irrf = calcularIRRF(baseTributavel - inss.valor, dependentes, competencia);
  memoriaCalculo.push({ label: "IRRF sobre férias + 1/3", valor: irrf.valor });

  const valorLiquido = arredondar(
    valorGozado + tercoConstitucional + abono + tercoAbono - inss.valor - irrf.valor,
  );
  memoriaCalculo.push({ label: "Valor líquido a receber", valor: valorLiquido });

  return {
    valor: valorLiquido,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      valorGozado,
      tercoConstitucional,
      diasVendidos,
      abono,
      tercoAbono,
      inss: inss.valor,
      irrf: irrf.valor,
      valorLiquido,
    },
  };
}

export interface PrazoConcessaoFerias {
  vencida: boolean;
  diasAtraso: number;
  limiteConcessao: string;
}

/**
 * O período concessivo de férias vai até 12 meses após o fim do período
 * aquisitivo (Art. 134 CLT). Concedidas após esse prazo, as férias são
 * consideradas vencidas e devem ser pagas em dobro (Art. 137 CLT).
 */
export function avaliarPrazoConcessao(
  periodoAquisitivoFim: Date,
  dataConcessao: Date,
): PrazoConcessaoFerias {
  const limite = new Date(periodoAquisitivoFim);
  limite.setMonth(limite.getMonth() + 12);

  const diasAtraso = Math.max(
    0,
    Math.floor((dataConcessao.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    vencida: diasAtraso > 0,
    diasAtraso,
    limiteConcessao: limite.toISOString().slice(0, 10),
  };
}
