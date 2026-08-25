import { arredondar } from "./types";

/** Jornada mensal padrão (44h semanais). O cadastro ainda não guarda a jornada por pessoa. */
export const JORNADA_MENSAL_PADRAO = 220;

/** Adicional noturno do Art. 73 CLT: 20% sobre a hora normal. */
export const ADICIONAL_NOTURNO = 0.2;

export interface HorasLancadas {
  /** Horas decimais. "08:01" chega aqui como 8,0167 — ver lib/folha/horas.ts. */
  extra50: number | null;
  extra100: number | null;
  desconto: number | null;
  noturna: number | null;
}

/** Calendário do mês para o DSR. Sem ele, o reflexo não é calculado. */
export interface CalendarioDsr {
  /** Dias úteis do mês — o número que o DP mantém em Benefícios, já com feriados. */
  diasUteis: number;
  /** Domingos e feriados: o complemento dos dias úteis no mês. */
  diasDsr: number;
}

export interface ValorDasHoras {
  valorHoraNormal: number;
  extra50: number;
  extra100: number;
  /** Positivo aqui; quem soma o custo é que subtrai. */
  desconto: number;
  noturna: number;
  /** Reflexo no descanso semanal remunerado (Lei 605/1949). Zero sem calendário. */
  dsr: number;
  /** extra50 + extra100 + noturna + dsr − desconto: o efeito líquido na folha. */
  liquido: number;
}

/**
 * Converte as horas lançadas em dinheiro.
 *
 * Hora extra de 50% vale 1,5× a hora normal e a de 100% vale 2× (Art. 7º, XVI
 * CF). A hora noturna soma só o ADICIONAL de 20%: as horas em si já estão no
 * salário do mês, e pagá-las de novo dobraria o valor. O desconto de horas sai
 * pela hora normal, sem adicional nenhum.
 *
 * O DSR (Lei 605/1949) reflete sobre os adicionais — hora extra e noturno —
 * pela fórmula do DP: valor dos adicionais ÷ dias úteis × dias de DSR. O
 * desconto de horas fica de fora: ele não é adicional, é hora não trabalhada.
 *
 * Sem `calendario` o DSR é zero, e de propósito: ele depende dos dias úteis do
 * mês, que já incluem os feriados. Chutar 25/5 daria um número errado com cara
 * de certo — o número real vem da tabela que o DP mantém em Benefícios.
 */
export function calcularValorDasHoras(
  salarioBase: number,
  horas: HorasLancadas,
  jornadaMensal: number = JORNADA_MENSAL_PADRAO,
  calendario?: CalendarioDsr,
): ValorDasHoras {
  const valorHoraNormal = jornadaMensal > 0 ? salarioBase / jornadaMensal : 0;

  const extra50 = arredondar((horas.extra50 ?? 0) * valorHoraNormal * 1.5);
  const extra100 = arredondar((horas.extra100 ?? 0) * valorHoraNormal * 2);
  const noturna = arredondar((horas.noturna ?? 0) * valorHoraNormal * ADICIONAL_NOTURNO);
  const desconto = arredondar((horas.desconto ?? 0) * valorHoraNormal);

  // A base do DSR são os ADICIONAIS do mês, não o desconto.
  const baseDsr = extra50 + extra100 + noturna;
  const dsr =
    calendario && calendario.diasUteis > 0 && calendario.diasDsr > 0
      ? arredondar((baseDsr / calendario.diasUteis) * calendario.diasDsr)
      : 0;

  return {
    valorHoraNormal: arredondar(valorHoraNormal),
    extra50,
    extra100,
    desconto,
    noturna,
    dsr,
    liquido: arredondar(extra50 + extra100 + noturna + dsr - desconto),
  };
}
