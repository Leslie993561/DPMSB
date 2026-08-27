/**
 * Quem entra na folha de cada competência. Vive fora de `lib/db` de propósito:
 * `folhaBreakdown` é "server-only" e não pode ser importado por um teste, e
 * esta é uma regra de negócio pura, que merece teste próprio.
 */
export interface VigenciaColaborador {
  dataAdmissao: string | null;
  dataDesligamento: string | null;
  /** "ativo" | "desligado" — vale quando a data de desligamento está inutilizável. */
  status?: string | null;
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
  const dataUtilizavel = Boolean(desligamento && desligamento >= colaborador.dataAdmissao!);

  if (dataUtilizavel) {
    if (competencia >= desligamento!.slice(0, 7)) return false;
    return true;
  }

  // Data inutilizável, mas o cadastro diz "desligado": a pessoa não está na
  // folha de hoje, e é isso que se pode afirmar. Sem data válida não há como
  // saber em que mês ela saiu, então as competências passadas ficam como
  // estavam — reescrever o histórico com um mês chutado seria pior do que a
  // data errada. O aviso de cadastro inconsistente cobra a correção.
  if (colaborador.status === "desligado" && competencia >= mesAtual()) return false;

  return true;
}

/** Competência corrente, no formato "AAAA-MM". */
function mesAtual(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}
