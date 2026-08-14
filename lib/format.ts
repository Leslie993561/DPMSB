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
