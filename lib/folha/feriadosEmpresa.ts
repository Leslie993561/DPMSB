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

/**
 * Dias úteis que valem para o transporte: os do mês menos os dias sem expediente.
 * Só a mobilidade de valor FIXO mensal ignora os feriados (o valor é o mesmo
 * seja qual for o mês); mobilidade com valor por dia conta como vale-transporte.
 */
export function diasUteisParaTransporte(
  c: { tipoTransporte: string; valorTransporteDia: number | null },
  diasUteisDoMes: number,
  diasSemExpedienteNoMes: number,
): number {
  const fixoMensal = c.tipoTransporte === "vm_fixo" && !((c.valorTransporteDia ?? 0) > 0);
  return fixoMensal ? diasUteisDoMes : Math.max(0, diasUteisDoMes - diasSemExpedienteNoMes);
}
