/**
 * Regra de férias do colaborador PJ (vínculo "PJ").
 *
 * Difere da CLT em quatro pontos, todos concentrados aqui para a regra não
 * se espalhar pelo resto do módulo de Férias:
 *  - não existe período concessivo: nada vence, nada "vira dobro";
 *  - o saldo acumula (30 dias por aquisitivo completo) e é abatido sempre do
 *    período mais antigo primeiro;
 *  - fracionamento livre: a única validação é caber no saldo;
 *  - o valor é só valor mensal ÷ 30 × dias — sem 1/3, 13º, abono, INSS ou FGTS.
 */

export const DIAS_DIREITO_PJ = 30;
/** Mês comercial: o valor diário nunca usa os dias reais do mês. */
export const DIAS_MES_PJ = 30;

export interface PeriodoPj {
  inicio: string;
  fim: string;
}

export interface SaldoPeriodoPj extends PeriodoPj {
  direito: number;
  gozado: number;
  saldo: number;
}

function paraUtc(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia, ou o último dia do mês quando ele não existe (31/01 + 1 mês = 28/02). */
function somarMeses(iso: string, meses: number): string {
  const base = paraUtc(iso);
  const dia = base.getUTCDate();
  const alvo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return paraIso(alvo);
}

function diaAnterior(iso: string): string {
  const d = paraUtc(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return paraIso(d);
}

/**
 * Períodos aquisitivos JÁ COMPLETOS: a cada 12 meses inteiros de contrato,
 * contados do início, nasce um período de 30 dias. Antes de completar o
 * primeiro ano não há nenhum (saldo 0).
 */
export function periodosAquisitivosCompletos(inicioContrato: string, hoje: Date | string): PeriodoPj[] {
  const hojeIso = typeof hoje === "string" ? hoje.slice(0, 10) : paraIso(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())));
  const periodos: PeriodoPj[] = [];
  // 80 voltas = 80 anos de contrato; protege contra data inválida.
  for (let n = 1; n <= 80; n++) {
    const proximo = somarMeses(inicioContrato, 12 * n);
    if (proximo > hojeIso) break;
    periodos.push({ inicio: somarMeses(inicioContrato, 12 * (n - 1)), fim: diaAnterior(proximo) });
  }
  return periodos;
}

/**
 * Saldo de cada período: os dias gozados saem SEMPRE do período mais antigo
 * primeiro, e só passam ao seguinte quando o anterior zera.
 */
export function saldosPorPeriodo(periodos: PeriodoPj[], diasGozados: number): SaldoPeriodoPj[] {
  let restante = Math.max(0, diasGozados);
  return periodos.map((p) => {
    const gozado = Math.min(DIAS_DIREITO_PJ, restante);
    restante -= gozado;
    return { ...p, direito: DIAS_DIREITO_PJ, gozado, saldo: DIAS_DIREITO_PJ - gozado };
  });
}

/** Saldo total = (períodos completos × 30) − dias já gozados. Nunca negativo. */
export function saldoTotalPj(periodos: PeriodoPj[], diasGozados: number): number {
  return Math.max(0, periodos.length * DIAS_DIREITO_PJ - diasGozados);
}

/**
 * Reparte `dias` pedidos entre os períodos, do mais antigo ao mais novo, a
 * partir dos saldos atuais. `null` quando o pedido não cabe no saldo — essa é a
 * única validação de PJ (sem mínimo de dias, sem limite de parcelas).
 */
export function alocarDiasPj(saldos: SaldoPeriodoPj[], dias: number): { indice: number; dias: number }[] | null {
  if (!Number.isInteger(dias) || dias <= 0) return null;
  const total = saldos.reduce((s, p) => s + p.saldo, 0);
  if (dias > total) return null;
  const partes: { indice: number; dias: number }[] = [];
  let restante = dias;
  saldos.forEach((p, indice) => {
    if (restante <= 0 || p.saldo <= 0) return;
    const parte = Math.min(p.saldo, restante);
    partes.push({ indice, dias: parte });
    restante -= parte;
  });
  return partes;
}

/** Valor das férias: valor mensal ÷ 30 × dias, em arredondamento de centavo. Sem nenhum provento adicional. */
export function valorFeriasPj(valorMensal: number, dias: number): number {
  return Math.round(((valorMensal / DIAS_MES_PJ) * dias + Number.EPSILON) * 100) / 100;
}
