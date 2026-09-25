/**
 * Dias em que a empresa não funciona (feriado local, ponto facultativo,
 * recesso) marcados à mão no calendário do Rateio — além do fim de semana já
 * embutido em `diasUteisPadrao`.
 *
 * Só abatem o Vale-Transporte: quem não vai à empresa não desloca. Mobilidade
 * (VM) e Alimentação continuam pelo cálculo normal de dias úteis — pedido
 * explícito do DP, os dois benefícios não variam com feriado local.
 */

function ehDiaUtil(data: Date): boolean {
  const dia = data.getUTCDay();
  return dia >= 1 && dia <= 5;
}

/** Quantas das datas (AAAA-MM-DD) marcadas caem dentro da competência E são dia útil (segunda a sexta). */
export function diasUteisFeriadosNoMes(competencia: string, feriados: string[]): number {
  let dias = 0;
  for (const data of feriados) {
    if (!data.startsWith(`${competencia}-`)) continue;
    const d = new Date(`${data}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && ehDiaUtil(d)) dias++;
  }
  return dias;
}
