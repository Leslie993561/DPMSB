/** Tipos de movimentação do quadro, escolhidos pelo RH no Histórico de movimentações. */
export const TIPOS_ENTRADA = ["Aumento de quadro", "Substituição"] as const;

export const TIPOS_SAIDA = [
  "Dispensa sem justa causa",
  "Dispensa por justa causa",
  "Pedido de demissão",
  "Término de contrato",
  "Acordo (art. 484-A)",
  "Outro",
] as const;

export type TipoMovimento = "entrada" | "saida";

export function tiposDoMovimento(movimento: TipoMovimento): readonly string[] {
  return movimento === "entrada" ? TIPOS_ENTRADA : TIPOS_SAIDA;
}
