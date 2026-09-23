import "server-only";
import { listarColaboradores, type Vinculo } from "@/lib/db/colaboradores";
import { sstQuery } from "./db";

export interface ColaboradorEpi {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: Vinculo | null;
  /** E-mail profissional — para onde vai o link de assinatura da ficha. */
  email: string | null;
  /** Função da matriz de EPI que corresponde ao cargo/setor — null se nenhuma bate. */
  funcaoMatriz: string | null;
  episObrigatorios: string[];
  situacaoEpi: SituacaoEpi;
}

const PALAVRAS_IGNORADAS = new Set(["de", "da", "do", "das", "dos", "em", "e", "a", "i", "ii", "iii"]);

/** "Líder De Manutenção" → {lider, manut}: sem acento, sem conectivos, 5 letras (logística ≈ logístico). */
function radicais(texto: string | null): string[] {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !PALAVRAS_IGNORADAS.has(p))
    .map((p) => p.slice(0, 5));
}

/**
 * O Quadro guarda cargo e setor separados ("Auxiliar" · "Produção"); a matriz
 * usa o nome da função inteiro ("Auxiliar De Produção"). Casa quando TODO o
 * cargo está no nome da função e a maior parte da função é coberta por
 * cargo + setor — "Auxiliar" · "Administrativo" não vira Auxiliar de Produção.
 */
export function funcaoDaMatriz(cargo: string | null, departamento: string | null): FuncaoEpi | null {
  const doCargo = radicais(cargo);
  if (doCargo.length === 0) return null;
  const doColaborador = new Set([...doCargo, ...radicais(departamento)]);

  let melhor: { funcao: FuncaoEpi; cobertura: number; tamanho: number } | null = null;
  for (const funcao of MATRIZ_EPI) {
    const daFuncao = radicais(funcao.funcao);
    if (!doCargo.every((r) => daFuncao.includes(r))) continue;
    const cobertura = daFuncao.filter((r) => doColaborador.has(r)).length / daFuncao.length;
    if (cobertura < 0.6) continue;
    // Empate (ex.: Auxiliar de Produção e Auxiliar de Produção I, mesmos EPIs): fica o nome mais curto.
    if (!melhor || cobertura > melhor.cobertura || (cobertura === melhor.cobertura && funcao.funcao.length < melhor.tamanho)) {
      melhor = { funcao, cobertura, tamanho: funcao.funcao.length };
    }
  }
  return melhor?.funcao ?? null;
}

/**
 * Usa o MESMO cadastro do Quadro de Colaboradores (banco principal do Portal
 * Recursos Humanos) — não o banco separado do SST, que não tem essa base
 * populada. É a lista de quem pode receber EPI, não uma base à parte.
 */
export async function listarColaboradoresParaEpi(): Promise<ColaboradorEpi[]> {
  const [todos, ultimasEntregas] = await Promise.all([
    listarColaboradores(),
    // Só a entrega mais recente de cada EPI por colaborador vale para o vencimento.
    sstQuery<{ colab_id: string; epi: string; data_troca: string }>(
      `SELECT DISTINCT ON (colab_id, epi) colab_id, epi, data_troca
         FROM sst_entregas_epi ORDER BY colab_id, epi, created_at DESC`,
    ),
  ]);
  const trocaPorColaborador = new Map<number, Map<string, string>>();
  for (const e of ultimasEntregas) {
    const id = Number(e.colab_id);
    const mapa = trocaPorColaborador.get(id) ?? new Map<string, string>();
    mapa.set(e.epi, e.data_troca);
    trocaPorColaborador.set(id, mapa);
  }

  return todos
    .filter((c) => c.status !== "desligado")
    .map((c) => {
      const funcao = funcaoDaMatriz(c.cargo, c.departamento);
      const episObrigatorios = funcao?.epis ?? [];
      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        departamento: c.departamento,
        vinculo: c.vinculo,
        email: c.email,
        funcaoMatriz: funcao?.funcao ?? null,
        episObrigatorios,
        situacaoEpi: situacaoDosEpis(episObrigatorios, trocaPorColaborador.get(c.id) ?? new Map()),
      };
    });
}

export interface SituacaoEpi {
  vencidos: number;
  vencendo: number;
  emDia: number;
  /** Base das frações: EPIs obrigatórios da função (ou os entregues, se a função não tem). */
  total: number;
}

const DIAS_ALERTA_VENCIMENTO = 30;

/** "DD/MM/AAAA" → dias até a data (negativo = já passou); null se vazio/ inválido. */
function diasAte(dataBr: string, hoje: Date): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return null;
  const alvo = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

/**
 * Pela troca prevista da última entrega de cada EPI: vencido (troca já passou),
 * vencendo (até 30 dias) ou em dia (mais longe ou sem data de troca). EPI
 * obrigatório nunca entregue não entra em nenhuma — é divergência, na ficha.
 */
function situacaoDosEpis(obrigatorios: string[], trocaPorEpi: Map<string, string>): SituacaoEpi {
  const base = obrigatorios.length > 0 ? obrigatorios : [...trocaPorEpi.keys()];
  const hoje = new Date();
  const situacao: SituacaoEpi = { vencidos: 0, vencendo: 0, emDia: 0, total: base.length };
  for (const epi of base) {
    if (!trocaPorEpi.has(epi)) continue;
    const dias = diasAte(trocaPorEpi.get(epi) ?? "", hoje);
    if (dias !== null && dias < 0) situacao.vencidos++;
    else if (dias !== null && dias <= DIAS_ALERTA_VENCIMENTO) situacao.vencendo++;
    else situacao.emDia++;
  }
  return situacao;
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

/**
 * Catálogo de EPI: preço base (do Portal SST original, `epiCatalogo.json`) e
 * C.A. padrão, que vem preenchido na entrega e pode ser editado ali. Um preço
 * cadastrado em sst_epi_precos, quando existir, prevalece sobre este.
 */
export const EPI_CATALOGO: { equip: string; valor: number; ca: string }[] = [
  { equip: "Calçado Antiderrapante", valor: 80, ca: "27.921" },
  { equip: "Sandália", valor: 35, ca: "" },
  { equip: "Abafador 3M Muffler", valor: 80, ca: "14.235" },
  { equip: "Protetor Auricular Interno", valor: 1, ca: "15.485" },
  { equip: "Máscara Semifacial", valor: 70, ca: "7072" },
  { equip: "Óculos de Proteção com UV", valor: 10, ca: "28.018" },
  { equip: "Óculos de Proteção Transparente", valor: 10, ca: "40.957" },
  { equip: "Bota-biqueira de PVC", valor: 120, ca: "" },
];

interface LinhaEntregaEpi {
  epi: string;
  qtd: number;
  valor_unit: number;
  data_entrega: string;
}

/** Preço vigente de cada EPI: catálogo base, sobrescrito pelo que estiver em sst_epi_precos. */
export async function obterPrecosEpi(): Promise<Map<string, number>> {
  // ::float8 porque o pg devolve `numeric` como texto — somar texto concatenaria.
  const precos = await sstQuery<{ equip: string; valor: number }>(
    "SELECT equip, valor::float8 AS valor FROM sst_epi_precos",
  );
  return new Map<string, number>([
    ...EPI_CATALOGO.map((c) => [c.equip, c.valor] as const),
    ...precos.map((p) => [p.equip, p.valor] as const),
  ]);
}

export interface CustoTrimestre {
  label: string;
  quantidade: number;
  valor: number;
}

export interface LinhaCustoEpi {
  epi: string;
  /** C.A. padrão do catálogo (vazio quando o EPI não tem). */
  ca: string;
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

  const [entregas, precoPorEpi] = await Promise.all([
    sstQuery<LinhaEntregaEpi>(
      "SELECT epi, qtd, valor_unit::float8 AS valor_unit, data_entrega FROM sst_entregas_epi",
    ),
    obterPrecosEpi(),
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

  const ordemCatalogo = new Map(EPI_CATALOGO.map((c, i) => [c.equip, i]));
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
      const ca = EPI_CATALOGO.find((c) => c.equip === epi)?.ca ?? "";
      return { epi, ca, quantidade, valorUnitario, valorTotal: quantidade * valorUnitario };
    })
    .sort(
      (a, b) =>
        b.valorTotal - a.valorTotal ||
        (ordemCatalogo.get(a.epi) ?? 99) - (ordemCatalogo.get(b.epi) ?? 99) ||
        a.epi.localeCompare(b.epi, "pt-BR"),
    );

  return { trimestres, linhas };
}

/** Itens de fardamento e preço base; um preço em sst_fardamento_precos prevalece. */
export const FARDAMENTO_CATALOGO: { tipo: string; valor: number }[] = [
  { tipo: "Camisa Helanca", valor: 72 },
  { tipo: "Camisa Oxford", valor: 93 },
  { tipo: "Calça Helanca", valor: 72 },
  { tipo: "Calça Oxford", valor: 93 },
  { tipo: "Jaleco Antiestático", valor: 50 },
  { tipo: "Macacão Antiestático", valor: 100 },
];

/** Preço vigente de cada item de fardamento: catálogo, sobrescrito por sst_fardamento_precos. */
export async function obterPrecosFardamento(): Promise<Map<string, number>> {
  const precos = await sstQuery<{ tipo: string; valor: number }>(
    "SELECT tipo, valor::float8 AS valor FROM sst_fardamento_precos",
  );
  return new Map<string, number>([
    ...FARDAMENTO_CATALOGO.map((c) => [c.tipo, c.valor] as const),
    ...precos.map((p) => [p.tipo, p.valor] as const),
  ]);
}

export interface LinhaCustoFardamento {
  tipo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

/** Fardamento entregue (sst_fardamento_entregas) × preço vigente, no mesmo formato da planilha de EPI. */
export async function obterCustosFardamento(): Promise<LinhaCustoFardamento[]> {
  const [entregas, precoPorTipo] = await Promise.all([
    sstQuery<{ tipo: string; qtd: number }>("SELECT tipo, qtd FROM sst_fardamento_entregas"),
    obterPrecosFardamento(),
  ]);
  const qtdPorTipo = new Map<string, number>();
  for (const e of entregas) qtdPorTipo.set(e.tipo, (qtdPorTipo.get(e.tipo) ?? 0) + e.qtd);

  const ordem = new Map(FARDAMENTO_CATALOGO.map((c, i) => [c.tipo, i]));
  return [...new Set([...precoPorTipo.keys(), ...qtdPorTipo.keys()])]
    .map((tipo) => {
      const quantidade = qtdPorTipo.get(tipo) ?? 0;
      const valorUnitario = precoPorTipo.get(tipo) ?? 0;
      return { tipo, quantidade, valorUnitario, valorTotal: quantidade * valorUnitario };
    })
    .sort((a, b) => (ordem.get(a.tipo) ?? 99) - (ordem.get(b.tipo) ?? 99) || a.tipo.localeCompare(b.tipo, "pt-BR"));
}
