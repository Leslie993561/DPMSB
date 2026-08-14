import type { LegalTable } from "./types";
import { legalTable2025 } from "./2025";

export type { LegalTable, FaixaINSS, FaixaIRRF } from "./types";

const tables: LegalTable[] = [legalTable2025];

/**
 * Resolve a tabela legal vigente para uma data de competência.
 * Ao adicionar um novo ano, crie `lib/legal-tables/{ano}.ts` e inclua-o aqui.
 */
export function getLegalTable(competencia: Date): LegalTable {
  const aplicaveis = tables
    .filter((t) => new Date(t.effectiveFrom) <= competencia)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  const tabela = aplicaveis[0];
  if (!tabela) {
    throw new Error(
      `Nenhuma tabela legal encontrada para a competência ${competencia.toISOString()}. ` +
        `Tabela mais antiga disponível: ${tables[tables.length - 1]?.effectiveFrom ?? "nenhuma"}.`,
    );
  }
  return tabela;
}
