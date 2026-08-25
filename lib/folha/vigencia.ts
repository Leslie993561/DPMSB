/**
 * Quem entra na folha de cada competência. Vive fora de `lib/db` de propósito:
 * `folhaBreakdown` é "server-only" e não pode ser importado por um teste, e
 * esta é uma regra de negócio pura, que merece teste próprio.
 */
export interface VigenciaColaborador {
  dataAdmissao: string | null;
  dataDesligamento: string | null;
}

/**
 * O colaborador entra na folha do mês em que foi ADMITIDO e sai no mês em que
 * foi DESLIGADO — antes, o relatório listava todo mundo em toda competência,
 * então quem foi contratado em agosto aparecia também em julho, e quem saiu
 * continuava para sempre.
 *
 * A comparação é por MÊS ("AAAA-MM"), não por dia: quem entra dia 10 já conta o
 * mês inteiro, e quem sai dia 15 já não aparece naquele mês. É a regra que o DP
 * pediu; a rescisão do mês da saída é acompanhada no módulo de Rescisão.
 *
 * Sem data de admissão o colaborador não entra em competência nenhuma: não há
 * como saber desde quando ele custa, e chutar encheria meses passados de gente
 * que não estava lá.
 */
export function estaNaFolha(colaborador: VigenciaColaborador, competencia: string): boolean {
  const mesAdmissao = colaborador.dataAdmissao?.slice(0, 7);
  if (!mesAdmissao || competencia < mesAdmissao) return false;

  // Data de desligamento ANTERIOR à admissão é impossível e só pode ser erro
  // de digitação — nesse caso ela é ignorada, e a pessoa continua na folha. Sem
  // esta guarda, um dígito trocado no cadastro apagava o colaborador de todas
  // as competências sem deixar rastro do motivo.
  const desligamento = colaborador.dataDesligamento;
  if (desligamento && desligamento >= colaborador.dataAdmissao!) {
    if (competencia >= desligamento.slice(0, 7)) return false;
  }

  return true;
}
