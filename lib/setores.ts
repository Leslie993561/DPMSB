/** Sigla de setor/centro de custo usada nos chips de filtro — mesma convenção do relatório do DP. */
const SIGLA_POR_SETOR: Record<string, string> = {
  Administrativo: "ADM",
  Comercial: "COM",
  "Controle da Qualidade": "CQ",
  Contábil: "CTB",
  Diretoria: "DIR",
  Engenharia: "ENG",
  Financeiro: "FIN",
  "Garantia da Qualidade": "GQ",
  Industrial: "IND",
  Logística: "LOG",
  Manutenção: "MNT",
  "Operações de Vendas": "OV",
  Planejamento: "PLJ",
  Produção: "PRD",
  "Recursos Humanos": "RH",
  "Tecnologia da Informacao": "TI",
  "Tecnologia da Informação": "TI",
};

/** Retorna a sigla do setor se conhecida, senão o próprio nome (nunca esconde um setor não mapeado). */
export function siglaSetor(setor: string): string {
  return SIGLA_POR_SETOR[setor] ?? setor;
}
