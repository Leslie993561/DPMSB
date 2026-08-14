/**
 * Feriados nacionais FIXOS do Brasil (data não muda ano a ano). Não inclui
 * feriados móveis (Sexta-feira Santa, Carnaval, Corpus Christi) nem feriados
 * estaduais/municipais — expandir exigiria o cálculo da Páscoa e/ou uma base
 * de feriados por cidade, fora do escopo desta verificação.
 */
const FERIADOS_FIXOS: { mes: number; dia: number; nome: string }[] = [
  { mes: 1, dia: 1, nome: "Confraternização Universal" },
  { mes: 4, dia: 21, nome: "Tiradentes" },
  { mes: 5, dia: 1, nome: "Dia do Trabalho" },
  { mes: 9, dia: 7, nome: "Independência do Brasil" },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida" },
  { mes: 11, dia: 2, nome: "Finados" },
  { mes: 11, dia: 15, nome: "Proclamação da República" },
  { mes: 11, dia: 20, nome: "Consciência Negra" },
  { mes: 12, dia: 25, nome: "Natal" },
];

/** true se a data (ISO AAAA-MM-DD) cai em um feriado nacional fixo. */
export function ehFeriadoNacionalFixo(dataIso: string): { feriado: true; nome: string } | { feriado: false } {
  const [, mesStr, diaStr] = dataIso.split("-");
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  const encontrado = FERIADOS_FIXOS.find((f) => f.mes === mes && f.dia === dia);
  return encontrado ? { feriado: true, nome: encontrado.nome } : { feriado: false };
}
