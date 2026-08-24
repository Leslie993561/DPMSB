import type { LegalTable } from "./types";

/**
 * ATENÇÃO — VALORES A CONFERIR ANTES DE USO REAL:
 * Tabela vigente a partir de 2025-01-01, baseada na Portaria Interministerial
 * MPS/MF nº 6/2025 (INSS) e na Instrução Normativa RFB nº 2.222/2024 (IRRF).
 * Antes de calcular folha de pagamento real, confirme estes valores contra a
 * publicação oficial vigente na data da competência — eles podem ter sido
 * atualizados por norma posterior não refletida aqui.
 */
export const legalTable2025: LegalTable = {
  effectiveFrom: "2025-01-01",
  fonte:
    "Portaria Interministerial MPS/MF nº 6/2025 (INSS); Instrução Normativa RFB nº 2.222/2024 (IRRF) — CONFERIR VIGÊNCIA",
  salarioMinimo: 1518.0,
  inss: {
    faixas: [
      { ate: 1518.0, aliquota: 0.075 },
      { ate: 2793.88, aliquota: 0.09 },
      { ate: 4190.83, aliquota: 0.12 },
      { ate: 8157.41, aliquota: 0.14 },
    ],
    tetoContribuicao: 8157.41,
  },
  irrf: {
    faixas: [
      { ate: 2259.2, aliquota: 0, deducao: 0 },
      { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
      { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
      { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
      { ate: Infinity, aliquota: 0.275, deducao: 896.0 },
    ],
    deducaoPorDependente: 189.59,
  },
  fgts: {
    aliquota: 0.08,
    multaRescisoria: 0.4,
  },
  salarioFamilia: {
    // CONFERIR na portaria vigente: a cota e o teto mudam todo ano junto com o
    // reajuste do INSS, e um valor desatualizado aqui vira erro de folha.
    cotaPorFilho: 65.0,
    tetoRemuneracao: 1906.04,
  },
  inssPatronal: {
    // Alíquota básica do art. 22, I da Lei 8.212/91 — não considera RAT/FAP nem
    // enquadramento no Simples Nacional (que substitui essa contribuição).
    aliquota: 0.2,
  },
};
