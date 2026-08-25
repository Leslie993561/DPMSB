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

export interface ValorDasHoras {
  valorHoraNormal: number;
  extra50: number;
  extra100: number;
  /** Positivo aqui; quem soma o custo é que subtrai. */
  desconto: number;
  noturna: number;
  /** extra50 + extra100 + noturna − desconto: o efeito líquido na folha. */
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
 * O reflexo no DSR não entra aqui: ele depende do calendário de dias úteis e
 * de feriados do mês, que o portal não tem — estimar daria um número errado
 * com cara de certo.
 */
export function calcularValorDasHoras(
  salarioBase: number,
  horas: HorasLancadas,
  jornadaMensal: number = JORNADA_MENSAL_PADRAO,
): ValorDasHoras {
  const valorHoraNormal = jornadaMensal > 0 ? salarioBase / jornadaMensal : 0;

  const extra50 = arredondar((horas.extra50 ?? 0) * valorHoraNormal * 1.5);
  const extra100 = arredondar((horas.extra100 ?? 0) * valorHoraNormal * 2);
  const noturna = arredondar((horas.noturna ?? 0) * valorHoraNormal * ADICIONAL_NOTURNO);
  const desconto = arredondar((horas.desconto ?? 0) * valorHoraNormal);

  return {
    valorHoraNormal: arredondar(valorHoraNormal),
    extra50,
    extra100,
    desconto,
    noturna,
    liquido: arredondar(extra50 + extra100 + noturna - desconto),
  };
}
