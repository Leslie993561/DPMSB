export interface FaixaINSS {
  /** Limite superior da faixa (R$). Use Infinity para a última faixa, se aplicável. */
  ate: number;
  aliquota: number;
}

export interface FaixaIRRF {
  ate: number;
  aliquota: number;
  deducao: number;
}

export interface LegalTable {
  /** Data ISO a partir da qual esta tabela é válida (inclusive). */
  effectiveFrom: string;
  /** Fonte oficial (Portaria/Instrução Normativa) para auditoria. */
  fonte: string;
  salarioMinimo: number;
  inss: {
    faixas: FaixaINSS[];
    tetoContribuicao: number;
  };
  irrf: {
    faixas: FaixaIRRF[];
    deducaoPorDependente: number;
  };
  fgts: {
    aliquota: number;
    multaRescisoria: number;
  };
  inssPatronal: {
    /** Contribuição previdenciária patronal básica (Lei 8.212/91, art. 22, I) — 20% sobre a folha, sem RAT/terceiros. */
    aliquota: number;
  };
}
