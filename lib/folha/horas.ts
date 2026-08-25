/**
 * Conversão entre a forma como o DP escreve horas e o número que o cálculo
 * precisa. Vive fora de `lib/db` para poder ser testada sem subir servidor.
 *
 * O DP lança "08:01" querendo dizer oito horas e um minuto. Tratar isso como
 * o número 8,01 erraria o valor — um minuto vale 1/60 de hora, não 1/100.
 */

/** 8h01 em horas decimais: 8 + 1/60. */
export function parsearHoras(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;

  // Número puro já é hora decimal (8,5 = oito horas e meia).
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).trim();
  if (!texto) return null;

  // "08:01" ou "8h01" ou "8h 01min" — o separador varia, o significado não.
  const comMinutos = texto.match(/^(\d{1,3})\s*[:hH]\s*(\d{1,2})/);
  if (comMinutos) {
    const horas = Number(comMinutos[1]);
    const minutos = Number(comMinutos[2]);
    if (!Number.isFinite(horas) || !Number.isFinite(minutos) || minutos >= 60) return null;
    return horas + minutos / 60;
  }

  // "8h" sozinho.
  const soHoras = texto.match(/^(\d{1,3})\s*[hH]$/);
  if (soHoras) return Number(soHoras[1]);

  // "8,5" / "8.5" — decimal, com a vírgula do padrão brasileiro.
  const decimal = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
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
