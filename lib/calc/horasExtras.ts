import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export interface HorasExtrasInput {
  salarioBase: number;
  /** Horas mensais da jornada contratual (ex.: 220 para 44h/semana). */
  horasMensais: number;
  horasExtras: number;
  /** 0.5 para 50% ou 1.0 para 100% (dobro). */
  percentualAdicional: number;
  incluirDSR: boolean;
  /** Dias úteis no mês, usado apenas para estimar o DSR. Padrão: 25. */
  diasUteisMes?: number;
  /** Domingos e feriados no mês, usado apenas para estimar o DSR. Padrão: 5. */
  diasRepousoMes?: number;
}

export interface DetalheHorasExtras {
  valorHoraNormal: number;
  valorHoraExtra: number;
  valorTotalExtras: number;
  dsr: number;
}

/**
 * Cálculo de horas extras com adicional (Art. 7º, XVI CF) e, opcionalmente,
 * reflexo no Descanso Semanal Remunerado (DSR/Lei 605/1949). O DSR depende do
 * calendário real do mês (dias úteis × dias de repouso); os valores padrão
 * (25 dias úteis, 5 de repouso) são uma ESTIMATIVA — informe os valores reais
 * do mês para um cálculo preciso.
 */
export function calcularHorasExtras(input: HorasExtrasInput): CalculoResult<DetalheHorasExtras> {
  const {
    salarioBase,
    horasMensais,
    horasExtras,
    percentualAdicional,
    incluirDSR,
    diasUteisMes = 25,
    diasRepousoMes = 5,
  } = input;

  const valorHoraNormal = arredondar(salarioBase / horasMensais);
  const valorHoraExtra = arredondar(valorHoraNormal * (1 + percentualAdicional));
  const valorTotalExtras = arredondar(valorHoraExtra * horasExtras);

  const memoriaCalculo: MemoriaCalculoStep[] = [
    { label: "Valor da hora normal", formula: `R$ ${salarioBase.toFixed(2)} ÷ ${horasMensais}h`, valor: valorHoraNormal },
    {
      label: `Valor da hora extra (+${(percentualAdicional * 100).toFixed(0)}%)`,
      valor: valorHoraExtra,
    },
    { label: `Total de horas extras (${horasExtras}h)`, valor: valorTotalExtras },
  ];

  let dsr = 0;
  if (incluirDSR) {
    dsr = arredondar((valorTotalExtras / diasUteisMes) * diasRepousoMes);
    memoriaCalculo.push({
      label: `DSR sobre horas extras (${diasUteisMes} dias úteis / ${diasRepousoMes} dias de repouso)`,
      formula: `(R$ ${valorTotalExtras.toFixed(2)} ÷ ${diasUteisMes}) × ${diasRepousoMes}`,
      valor: dsr,
    });
  }

  const valor = arredondar(valorTotalExtras + dsr);

  return {
    valor,
    memoriaCalculo,
    tabelaLegalVersao: "N/A — cálculo não depende de tabela legal anual",
    detalhe: { valorHoraNormal, valorHoraExtra, valorTotalExtras, dsr },
  };
}
