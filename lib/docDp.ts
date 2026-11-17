/** Abas do módulo DOC. DP — cada uma é uma biblioteca de documentos por mês. */
export const CATEGORIAS_DOC_DP = ["beneficios", "programas", "departamento-pessoal"] as const;
export type CategoriaDocDp = (typeof CATEGORIAS_DOC_DP)[number];

export const INFO_DOC_DP: Record<CategoriaDocDp, { label: string; subtitulo: string }> = {
  beneficios: { label: "Benefícios", subtitulo: "Faturas, notas, boletos e contratos dos benefícios, mês a mês" },
  programas: { label: "Programas", subtitulo: "Documentos dos programas da empresa, mês a mês" },
  "departamento-pessoal": { label: "Departamento Pessoal", subtitulo: "Documentos do Departamento Pessoal, mês a mês" },
};
