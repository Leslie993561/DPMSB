/** Bibliotecas de documentos por mês, uma dentro de cada módulo do portal. */
export const CATEGORIAS_DOC_DP = ["ferias-recibos", "folha-documentos", "folha-arh"] as const;
export type CategoriaDocDp = (typeof CATEGORIAS_DOC_DP)[number];
