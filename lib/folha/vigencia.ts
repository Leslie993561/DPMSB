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

/** Alimentação paga por dia útil trabalhado a quem é desligado no mês (cortada na data do TRCT). */
export const VA_DIA_UTIL_DESLIGADO = 38.21;

/** O trecho do mês em que o colaborador esteve de fato na empresa. */
export interface PeriodoNaFolha {
  /** Primeiro dia trabalhado no mês (AAAA-MM-DD): a admissão, no mês de entrada; senão dia 1. */
  inicio: string;
  /** Último dia trabalhado no mês: a data do desligamento (TRCT), no mês de saída; senão o último dia. */
  fim: string;
  admitidoNoMes: boolean;
  desligadoNoMes: boolean;
  diasCorridos: number;
  diasNoMes: number;
}

const DIA_MS = 86_400_000;
const dataUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * Como `estaNaFolha`, mas o mês da saída CONTA (a pessoa trabalhou até o TRCT) e
 * devolve o trecho trabalhado, para salário e benefícios saírem proporcionais
 * à admissão e ao desligamento. `null` = fora da folha naquela competência.
 */
export function periodoNaFolha(colaborador: VigenciaColaborador, competencia: string): PeriodoNaFolha | null {
  const adm = colaborador.dataAdmissao;
  const mesAdmissao = adm?.slice(0, 7);
  if (!adm || !mesAdmissao || competencia < mesAdmissao) return null;

  const desl = colaborador.dataDesligamento;
  const dataUtilizavel = Boolean(desl && desl >= adm);
  if (dataUtilizavel && competencia > desl!.slice(0, 7)) return null;
  if (!dataUtilizavel && colaborador.status === "desligado" && competencia >= mesAtual()) return null;

  const ano = Number(competencia.slice(0, 4));
  const mes = Number(competencia.slice(5, 7));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const admitidoNoMes = mesAdmissao === competencia;
  const desligadoNoMes = dataUtilizavel && desl!.slice(0, 7) === competencia;
  const inicio = admitidoNoMes ? adm : `${competencia}-01`;
  const fim = desligadoNoMes ? desl! : `${competencia}-${String(diasNoMes).padStart(2, "0")}`;
  const diasCorridos = Math.round((dataUtc(fim).getTime() - dataUtc(inicio).getTime()) / DIA_MS) + 1;
  return { inicio, fim, admitidoNoMes, desligadoNoMes, diasCorridos, diasNoMes };
}

/** Dias de segunda a sexta entre duas datas (inclusive), sem os dias sem expediente informados. */
function diasUteisEntre(inicio: string, fim: string, semExpediente: Set<string>): number {
  let dias = 0;
  for (let d = dataUtc(inicio); d <= dataUtc(fim); d.setUTCDate(d.getUTCDate() + 1)) {
    const diaSemana = d.getUTCDay();
    if (diaSemana >= 1 && diaSemana <= 5 && !semExpediente.has(d.toISOString().slice(0, 10))) dias++;
  }
  return dias;
}

/**
 * Dias úteis efetivamente trabalhados no mês, na escala dos dias úteis que o
 * DP informou para a competência (`diasUteisDoMes`): mês cheio devolve o
 * próprio número; mês parcial devolve a parte proporcional, em dias inteiros.
 */
export function diasUteisTrabalhados(
  periodo: PeriodoNaFolha,
  competencia: string,
  diasUteisDoMes: number,
  semExpediente: string[] = [],
): { dias: number; razao: number } {
  if (periodo.diasCorridos >= periodo.diasNoMes) return { dias: diasUteisDoMes, razao: 1 };
  const feriados = new Set(semExpediente);
  const totalMes = diasUteisEntre(`${competencia}-01`, `${competencia}-${String(periodo.diasNoMes).padStart(2, "0")}`, feriados);
  const trabalhados = diasUteisEntre(periodo.inicio, periodo.fim, feriados);
  const razao = totalMes > 0 ? Math.min(1, trabalhados / totalMes) : 0;
  return { dias: Math.round(diasUteisDoMes * razao), razao };
}
