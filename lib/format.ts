const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatarMoeda(valor: number): string {
  return BRL.format(valor);
}

/** Número em pt-BR sem prefixo de moeda (ex.: "1.234,56") — usado em tabelas/planilhas de verbas. */
export function formatarNumero(valor: number): string {
  return NUMERO.format(valor);
}

/** Como `formatarNumero`, mas mostra "—" quando o valor é `null` (verba não importada para o mês). */
export function formatarNumeroOuTraco(valor: number | null): string {
  return valor === null ? "—" : NUMERO.format(valor);
}

/** Iniciais (até 2 letras) a partir de um nome completo, para avatares. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

/** Nome abreviado — primeiro nome e último sobrenome, como o DP identifica o colaborador em telas e planilhas curtas. */
export function abreviarNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Formata uma data ISO (AAAA-MM-DD) como dd/mm/aaaa. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Mascara um CPF mantendo só os 3 primeiros dígitos visíveis (LGPD). */
export function mascararCpf(cpf: string | null): string {
  if (!cpf) return "—";
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length < 3) return "**";
  return `${digitos.slice(0, 3)}.***.**${digitos.length > 9 ? "-**" : ""}`;
}

/**
 * Normaliza um CPF para 000.000.000-00 — o formato que o DP usa em toda
 * planilha. Planilha importada ora traz o CPF como texto pontuado, ora como
 * número puro (e aí o Excel come o zero à esquerda: 086.629.255-10 vira
 * 86629255-10, com só 10 dígitos); por isso completa com zero à esquerda até
 * 11 dígitos antes de pontuar.
 *
 * Sem 11 dígitos depois de completar, não é um CPF válido para formatar — o
 * valor volta como veio (só espaços nas pontas removidos), em vez de
 * inventar uma pontuação sobre um número que não fecha.
 */
export function formatarCpf(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const digitos = String(valor).replace(/\D/g, "");
  if (!digitos) return null;
  const completo = digitos.padStart(11, "0");
  if (completo.length !== 11) return String(valor).trim();
  return `${completo.slice(0, 3)}.${completo.slice(3, 6)}.${completo.slice(6, 9)}-${completo.slice(9, 11)}`;
}
