/**
 * Conversão entre a forma como o DP escreve horas e o número que o cálculo
 * precisa. Vive fora de `lib/db` para poder ser testada sem subir servidor.
 *
 * O DP lança "08:01" querendo dizer oito horas e um minuto. Tratar isso como
 * o número 8,01 erraria o valor — um minuto vale 1/60 de hora, não 1/100.
 */

/** 8h01 em horas decimais: 8 + 1/60. Negativo é aceito: o DP às vezes lança o desconto já com sinal. */
export function parsearHoras(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;

  // Número puro já é hora decimal (8,5 = oito horas e meia).
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).trim();
  if (!texto) return null;

  // O sinal vem antes de tudo; ignorá-lo inverteria o efeito na folha.
  const negativo = texto.startsWith("-");
  const semSinal = (negativo ? texto.slice(1) : texto).trim();
  const sinal = negativo ? -1 : 1;

  // "08:01" ou "8h01" ou "8h 01min" — o separador varia, o significado não.
  // Até quatro dígitos de hora: duração de mês inteiro ainda é duração.
  const comMinutos = semSinal.match(/^(\d{1,4})\s*[:hH]\s*(\d{1,2})/);
  if (comMinutos) {
    const horas = Number(comMinutos[1]);
    const minutos = Number(comMinutos[2]);
    if (!Number.isFinite(horas) || !Number.isFinite(minutos) || minutos >= 60) return null;
    return sinal * (horas + minutos / 60);
  }

  // "8h" sozinho.
  const soHoras = semSinal.match(/^(\d{1,4})\s*[hH]$/);
  if (soHoras) return sinal * Number(soHoras[1]);

  // "8,5" / "8.5" — decimal, com a vírgula do padrão brasileiro.
  const decimal = Number(semSinal.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(decimal) ? sinal * decimal : null;
}

/** 8,0167 -> "08:01". Volta à forma que o DP escreveu, para conferência. */
export function formatarHoras(horas: number | null): string {
  if (horas === null || !Number.isFinite(horas)) return "—";
  const sinal = horas < 0 ? "-" : "";
  const total = Math.round(Math.abs(horas) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sinal}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Teto de sanidade para UMA verba de horas no mês.
 *
 * A CLT limita a hora extra a 2h por dia (Art. 59), o que dá ~44h no mês; o
 * maior lançamento legítimo do arquivo do DP tem 18h18. Sessenta horas em uma
 * única coluna já é bem acima de qualquer mês normal, e quase sempre significa
 * célula com outro significado — valor em reais digitado no lugar da hora, que
 * foi exatamente o que apareceu com 219,66 e 144,01 no desconto.
 *
 * Serve para AVISAR, nunca para descartar em silêncio: quem lança é que sabe
 * se aquele número está certo.
 */
export const HORAS_IMPLAUSIVEIS_NO_MES = 60;

export function horasImplausiveis(horas: number | null): boolean {
  return horas !== null && Math.abs(horas) > HORAS_IMPLAUSIVEIS_NO_MES;
}
