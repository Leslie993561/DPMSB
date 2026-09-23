import "server-only";
import { listarColaboradores, type Vinculo } from "@/lib/db/colaboradores";
import { sstQuery } from "./db";

export interface ColaboradorEpi {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: Vinculo | null;
}

/**
 * Usa o MESMO cadastro do Quadro de Colaboradores (banco principal do Portal
 * Recursos Humanos) — não o banco separado do SST, que não tem essa base
 * populada. É a lista de quem pode receber EPI, não uma base à parte.
 */
export async function listarColaboradoresParaEpi(): Promise<ColaboradorEpi[]> {
  const todos = await listarColaboradores();
  return todos
    .filter((c) => c.status !== "desligado")
    .map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, departamento: c.departamento, vinculo: c.vinculo }));
}

export interface FuncaoEpi {
  funcao: string;
  epis: string[];
}

/**
 * Matriz função → EPIs obrigatórios. Estática de propósito (é assim no
 * Portal SST original, `src/data/matrizEpi.json`): não muda por colaborador,
 * só por função exercida.
 */
export const MATRIZ_EPI: FuncaoEpi[] = [
  {
    funcao: "Assistente Logístico",
    epis: ["Calçado Antiderrapante", "Sandália", "Abafador 3M Muffler", "Protetor Auricular Interno"],
  },
  {
    funcao: "Auxiliar De Produção",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  {
    funcao: "Auxiliar De Produção I",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  {
    funcao: "Auxiliar De Produção II",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  {
    funcao: "Auxiliar De Produção III",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  { funcao: "Auxiliar De Serviços Gerais", epis: ["Calçado Antiderrapante", "Sandália"] },
  { funcao: "Inspetora Da Qualidade", epis: ["Calçado Antiderrapante", "Sandália"] },
  {
    funcao: "Líder De Manutenção",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  {
    funcao: "Supervisor (a) De Produção",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Sandália",
    ],
  },
  {
    funcao: "Técnico Em Manutenção Geral",
    epis: [
      "Abafador 3M Muffler",
      "Óculos de Proteção com UV",
      "Óculos de Proteção Transparente",
      "Máscara Semifacial",
      "Protetor Auricular Interno",
      "Calçado Antiderrapante",
      "Bota-biqueira de PVC",
      "Sandália",
    ],
  },
];

interface LinhaEntregaEpi {
  epi: string;
  qtd: number;
  valor_unit: number;
  data_entrega: string;
}

interface LinhaPrecoEpi {
  equip: string;
  valor: number;
}

export interface CustoTrimestre {
  label: string;
  quantidade: number;
  valor: number;
}

export interface LinhaCustoEpi {
  epi: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DashboardCustosEpi {
  trimestres: CustoTrimestre[];
  linhas: LinhaCustoEpi[];
}

const ROTULO_TRIMESTRE = ["Q1 · jan-fev-mar", "Q2 · abr-mai-jun", "Q3 · jul-ago-set", "Q4 · out-nov-dez"];

/** "DD/MM/AAAA" → {mes, ano}; formato inválido/vazio não entra em nenhum trimestre. */
function mesEAnoBr(dataBr: string): { mes: number; ano: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return null;
  return { mes: Number(m[2]), ano: Number(m[3]) };
}

/**
 * Custos de EPI: quanto foi ENTREGUE de fato (sst_entregas_epi), não a
 * demanda teórica da matriz. Trimestres do ano corrente; a planilha por EPI
 * usa o preço vigente do catálogo (sst_epi_precos) quando existe, senão a
 * média do valor praticado nas entregas daquele EPI.
 */
export async function obterCustosEpi(): Promise<DashboardCustosEpi> {
  const anoAtual = new Date().getFullYear();

  const [entregas, precos] = await Promise.all([
    sstQuery<LinhaEntregaEpi>("SELECT epi, qtd, valor_unit, data_entrega FROM sst_entregas_epi"),
    sstQuery<LinhaPrecoEpi>("SELECT equip, valor FROM sst_epi_precos"),
  ]);

  const trimestres: CustoTrimestre[] = ROTULO_TRIMESTRE.map((label) => ({ label, quantidade: 0, valor: 0 }));
  for (const e of entregas) {
    const data = mesEAnoBr(e.data_entrega);
    if (!data || data.ano !== anoAtual) continue;
    const q = Math.floor((data.mes - 1) / 3);
    if (q < 0 || q > 3) continue;
    trimestres[q].quantidade += e.qtd;
    trimestres[q].valor += e.qtd * e.valor_unit;
  }

  const precoPorEpi = new Map(precos.map((p) => [p.equip, p.valor]));
  const somaQtdPorEpi = new Map<string, number>();
  const somaValorPorEpi = new Map<string, number>();
  for (const e of entregas) {
    somaQtdPorEpi.set(e.epi, (somaQtdPorEpi.get(e.epi) ?? 0) + e.qtd);
    somaValorPorEpi.set(e.epi, (somaValorPorEpi.get(e.epi) ?? 0) + e.qtd * e.valor_unit);
  }

  const nomesEpi = new Set<string>([...precoPorEpi.keys(), ...somaQtdPorEpi.keys()]);
  const linhas: LinhaCustoEpi[] = [...nomesEpi]
    .map((epi) => {
      const quantidade = somaQtdPorEpi.get(epi) ?? 0;
      const somaValor = somaValorPorEpi.get(epi) ?? 0;
      const valorUnitario = precoPorEpi.get(epi) ?? (quantidade > 0 ? somaValor / quantidade : 0);
      return { epi, quantidade, valorUnitario, valorTotal: quantidade * valorUnitario };
    })
    .sort((a, b) => b.valorTotal - a.valorTotal || a.epi.localeCompare(b.epi, "pt-BR"));

  return { trimestres, linhas };
}
