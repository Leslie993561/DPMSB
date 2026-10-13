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
  "Planejamento Industrial e Operações": "PIO",
  Produção: "PRD",
  "Recursos Humanos": "RH",
  "Tecnologia da Informacao": "TI",
  "Tecnologia da Informação": "TI",
};

/** Chave de comparação: sem acento, caixa ou espaços extras (o setor vem de texto livre/importação). */
function chaveSetor(setor: string): string {
  return setor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const SIGLA_POR_CHAVE = new Map(Object.entries(SIGLA_POR_SETOR).map(([nome, sigla]) => [chaveSetor(nome), sigla]));

/** Retorna a sigla do setor se conhecida, senão o próprio nome (nunca esconde um setor não mapeado). */
export function siglaSetor(setor: string): string {
  return SIGLA_POR_SETOR[setor] ?? SIGLA_POR_CHAVE.get(chaveSetor(setor)) ?? setor;
}

/**
 * Lista fechada de setores pro cadastro de colaborador virar lista suspensa
 * em vez de texto livre — era assim que "mantenção" virava um setor novo ao
 * lado de "Manutenção" (ver lib/folha/parecidos.ts). Mesmos 16 nomes das
 * abas de filtro do Quadro de Colaboradores, uma grafia só por sigla.
 */
export const SETORES: string[] = [
  "Administrativo",
  "Comercial",
  "Controle da Qualidade",
  "Contábil",
  "Diretoria",
  "Engenharia",
  "Financeiro",
  "Garantia da Qualidade",
  "Industrial",
  "Logística",
  "Manutenção",
  "Operações de Vendas",
  "Planejamento",
  "Planejamento Industrial e Operações",
  "Produção",
  "Recursos Humanos",
  "Tecnologia da Informacao",
];
