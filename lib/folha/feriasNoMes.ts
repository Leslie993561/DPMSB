/**
 * Dias úteis de férias dentro de uma competência.
 *
 * Vale-transporte e vale-mobilidade pagam deslocamento: em dia de férias não há
 * deslocamento, e o benefício não é devido. Alimentação não entra nesta conta —
 * o DP paga o mês cheio.
 *
 * Só conta segunda a sexta. O portal guarda a QUANTIDADE de dias úteis do mês
 * (ajustável por causa de feriados), não um calendário de datas, então não há
 * como saber se um dia específico de férias caiu num feriado — que já estaria
 * fora da contagem do mês. O efeito é abater no máximo um dia a mais quando as
 * férias englobam feriado; o alternativo seria não abater nada.
 */

/** Um intervalo de gozo de férias, em datas ISO (AAAA-MM-DD). */
export interface JanelaDeFerias {
  inicio: string;
  fim: string;
}

function ehDiaUtil(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia >= 1 && dia <= 5;
}

/** Primeiro e último dia da competência, em UTC. */
function limitesDoMes(competencia: string): { inicio: Date; fim: Date } {
  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)),
    fim: new Date(Date.UTC(ano, mes, 0)),
  };
}

/**
 * Quantos dias úteis das janelas de férias caem dentro da competência.
 *
 * Janelas sobrepostas não contam duas vezes o mesmo dia — o mesmo dia de
 * calendário só pode ser abatido uma vez, mesmo que apareça em dois
 * lançamentos.
 */
export function diasUteisDeFeriasNoMes(competencia: string, janelas: JanelaDeFerias[]): number {
  if (janelas.length === 0) return 0;
  const { inicio: inicioMes, fim: fimMes } = limitesDoMes(competencia);
  const contados = new Set<string>();

  for (const janela of janelas) {
    if (!janela.inicio || !janela.fim) continue;
    const inicio = new Date(`${janela.inicio}T00:00:00Z`);
    const fim = new Date(`${janela.fim}T00:00:00Z`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) continue;

    const de = inicio > inicioMes ? inicio : inicioMes;
    const ate = fim < fimMes ? fim : fimMes;

    for (let d = new Date(de); d <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
      if (ehDiaUtil(d)) contados.add(d.toISOString().slice(0, 10));
    }
  }

  return contados.size;
}

/**
 * Valor do benefício de deslocamento proporcional aos dias efetivamente
 * trabalhados. `valorCheio` é o do mês inteiro — para VT, valor do dia × dias
 * úteis; para VM, o fixo mensal.
 */
export function proporcionalAosDiasTrabalhados(
  valorCheio: number,
  diasUteisDoMes: number,
  diasUteisDeFerias: number,
): number {
  if (diasUteisDoMes <= 0) return valorCheio;
  const trabalhados = Math.max(0, diasUteisDoMes - diasUteisDeFerias);
  return (valorCheio * trabalhados) / diasUteisDoMes;
}
