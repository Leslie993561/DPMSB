export interface PeriodoAquisitivoInfo {
  diasDireito: number;
  abonoUtilizado: boolean;
  /** Dias já vendidos, válido apenas quando abonoUtilizado é true. */
  diasAbono: number;
}

export interface LancamentoInfo {
  /** Dias de gozo (nunca inclui dias de abono). */
  dias: number;
}

export interface EstadoPeriodo {
  diasTirados: number;
  diasDireitoEfetivo: number;
  diasATirar: number;
  fracionamentos: number;
}

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string };

const MAX_FRACIONAMENTOS = 3;
const MIN_DIAS_PRIMEIRO_PERIODO = 14;
const MIN_DIAS_DEMAIS_PERIODOS = 5;

/**
 * Calcula o estado corrente de um período aquisitivo a partir dos lançamentos
 * já registrados (manuais ou calculados — ambos contam da mesma forma).
 */
export function calcularEstadoPeriodo(
  periodo: PeriodoAquisitivoInfo,
  lancamentos: LancamentoInfo[],
): EstadoPeriodo {
  const diasTirados = lancamentos.reduce((soma, l) => soma + l.dias, 0);
  const diasDireitoEfetivo = periodo.abonoUtilizado
    ? periodo.diasDireito - periodo.diasAbono
    : periodo.diasDireito;

  return {
    diasTirados,
    diasDireitoEfetivo,
    diasATirar: diasDireitoEfetivo - diasTirados,
    fracionamentos: lancamentos.length,
  };
}

/** Teto de dias de abono pecuniário: piso(dias de direito ÷ 3). */
export function tetoAbono(diasDireito: number): number {
  return Math.floor(diasDireito / 3);
}

/**
 * Verifica se `diasNovoGozo` (+ abono desta solicitação, se houver e ainda não
 * usado) cabe dentro dos dias de direito, considerando o que já foi tirado.
 * Se o abono já tiver sido usado antes, `estado.diasDireitoEfetivo` já reflete
 * essa redução — não subtraímos de novo.
 */
function verificarTeto(
  periodo: PeriodoAquisitivoInfo,
  estado: EstadoPeriodo,
  diasNovoGozo: number,
  abonoNestaSolicitacao: boolean,
  diasAbonoNestaSolicitacao: number,
): ResultadoValidacao {
  const reducaoAbonoNovo = !periodo.abonoUtilizado && abonoNestaSolicitacao ? diasAbonoNestaSolicitacao : 0;
  const limite = estado.diasDireitoEfetivo - reducaoAbonoNovo;

  if (estado.diasTirados + diasNovoGozo > limite) {
    return {
      ok: false,
      erro:
        `A soma dos dias já tirados (${estado.diasTirados}) com os dias solicitados ` +
        `(${diasNovoGozo}${abonoNestaSolicitacao ? ` + ${diasAbonoNestaSolicitacao} de abono` : ""}) ` +
        `excede os dias de direito do período aquisitivo (${periodo.diasDireito}).`,
    };
  }
  return { ok: true };
}

/**
 * Valida uma nova solicitação feita pelo modal de cálculo (fluxo normal do
 * sistema). Aplica o limite de 3 fracionamentos e os mínimos de dias por
 * posição (1º ≥ 14 dias, 2º/3º ≥ 5 dias — Art. 134, §1º CLT).
 */
export function validarNovoLancamentoCalculado(
  periodo: PeriodoAquisitivoInfo,
  estado: EstadoPeriodo,
  diasSolicitados: number,
  abonoSolicitado: boolean,
): ResultadoValidacao {
  if (diasSolicitados <= 0) {
    return { ok: false, erro: "Informe uma quantidade de dias maior que zero." };
  }

  if (estado.fracionamentos >= MAX_FRACIONAMENTOS) {
    return {
      ok: false,
      erro: `Limite de ${MAX_FRACIONAMENTOS} períodos fracionados já atingido para este período aquisitivo.`,
    };
  }

  const ordinal = estado.fracionamentos + 1;
  const minimoDias = ordinal === 1 ? MIN_DIAS_PRIMEIRO_PERIODO : MIN_DIAS_DEMAIS_PERIODOS;
  if (diasSolicitados < minimoDias) {
    return {
      ok: false,
      erro:
        ordinal === 1
          ? `O 1º período fracionado exige no mínimo ${MIN_DIAS_PRIMEIRO_PERIODO} dias (Art. 134, §1º CLT).`
          : `O 2º e o 3º período fracionado exigem no mínimo ${MIN_DIAS_DEMAIS_PERIODOS} dias cada (Art. 134, §1º CLT).`,
    };
  }

  if (abonoSolicitado && periodo.abonoUtilizado) {
    return {
      ok: false,
      erro: "Abono pecuniário já foi utilizado neste período aquisitivo — só pode ser solicitado uma vez.",
    };
  }

  const diasAbono = tetoAbono(periodo.diasDireito);
  return verificarTeto(periodo, estado, diasSolicitados, abonoSolicitado, diasAbono);
}

/**
 * Valida um lançamento manual/histórico (registro de fato já consumado antes
 * do sistema). NÃO aplica o limite de fracionamentos nem os mínimos de dias
 * por posição — só garante que o total não ultrapasse os dias de direito e
 * que o abono (se houver) respeite o teto e a regra de uso único.
 */
export function validarLancamentoManual(
  periodo: PeriodoAquisitivoInfo,
  estado: EstadoPeriodo,
  diasGozados: number,
  abonoSolicitado: boolean,
  diasVendidos: number,
): ResultadoValidacao {
  if (diasGozados < 0) {
    return { ok: false, erro: "Dias gozados não pode ser negativo." };
  }

  if (abonoSolicitado) {
    if (periodo.abonoUtilizado) {
      return {
        ok: false,
        erro: "Abono pecuniário já foi utilizado neste período aquisitivo — só pode ser registrado uma vez.",
      };
    }
    if (diasVendidos <= 0) {
      return { ok: false, erro: "Informe a quantidade de dias vendidos no abono." };
    }
    const teto = tetoAbono(periodo.diasDireito);
    if (diasVendidos > teto) {
      return {
        ok: false,
        erro: `O abono não pode exceder ${teto} dia(s) (piso de dias de direito ÷ 3).`,
      };
    }
  }

  return verificarTeto(periodo, estado, diasGozados, abonoSolicitado, diasVendidos);
}

/**
 * Risco de pagamento em dobro (Art. 137 CLT): as férias precisam ser
 * concedidas dentro do período concessivo. É risco se já está vencido (sem
 * nada programado) ou se a data de início do gozo (prevista ou real) cai
 * depois do limite de concessão.
 */
export function avaliarRiscoDobro(
  limiteConcessao: Date,
  dataInicioGozo: Date | null,
  hoje: Date,
): boolean {
  if (dataInicioGozo) return dataInicioGozo > limiteConcessao;
  return hoje > limiteConcessao;
}

/**
 * Valida um fracionamento completo (até 3 partes, Art. 134 §1º CLT): a maior
 * parte não pode ser menor que 14 dias corridos, as demais não podem ser
 * menores que 5, e a soma (+ dias de abono, se houver) não pode passar do
 * saldo do período.
 */
export function validarFracionamentoTotal(
  partes: number[],
  diasDireito: number,
  diasAbono: number,
): ResultadoValidacao {
  const partesValidas = partes.filter((d) => d > 0);
  if (partesValidas.length === 0) {
    return { ok: false, erro: "Informe ao menos uma parte do fracionamento." };
  }
  if (partesValidas.length > MAX_FRACIONAMENTOS) {
    return { ok: false, erro: `Limite de ${MAX_FRACIONAMENTOS} períodos fracionados.` };
  }

  const maior = Math.max(...partesValidas);
  if (maior < MIN_DIAS_PRIMEIRO_PERIODO) {
    return {
      ok: false,
      erro: `Ao menos uma parte deve ter no mínimo ${MIN_DIAS_PRIMEIRO_PERIODO} dias corridos (Art. 134, §1º CLT).`,
    };
  }
  let jaDescartouAMaior = false;
  for (const dias of partesValidas) {
    if (!jaDescartouAMaior && dias === maior) {
      jaDescartouAMaior = true;
      continue;
    }
    if (dias < MIN_DIAS_DEMAIS_PERIODOS) {
      return {
        ok: false,
        erro: `As demais partes devem ter no mínimo ${MIN_DIAS_DEMAIS_PERIODOS} dias corridos cada (Art. 134, §1º CLT).`,
      };
    }
  }

  const total = partesValidas.reduce((s, d) => s + d, 0) + diasAbono;
  if (total > diasDireito) {
    return {
      ok: false,
      erro: `A soma das partes (${partesValidas.reduce((s, d) => s + d, 0)}) + abono (${diasAbono}) excede o saldo do período (${diasDireito}).`,
    };
  }

  return { ok: true };
}
