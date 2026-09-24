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
  /** Tem ficha enviada e ainda não assinada (nem por assinatura eletrônica, nem por PDF anexado). */
  aguardandoAssinatura: boolean;
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
 * Lista de EPIs que a RH já editou por função (sst_matriz_epi_extra) —
 * quando existe, essa lista INTEIRA substitui a matriz estática pra aquela
 * função (não é só um "extra" somado aos fixos: todo item, fixo ou não, pode
 * ser editado ou removido pela tela).
 */
async function obterListaEditadaMatriz(): Promise<Map<string, string[]>> {
  const linhas = await sstQuery<{ funcao: string; epis: string[] }>("SELECT funcao, epis FROM sst_matriz_epi_extra");
  return new Map(linhas.map((l) => [l.funcao, l.epis]));
}

/**
 * Matriz para exibir/editar: cada função com sua lista de EPIs — a lista
 * estática (`MATRIZ_EPI`) até a RH editar algo pela tela; a partir daí, o que
 * estiver salvo em sst_matriz_epi_extra manda.
 */
export async function obterMatrizEpi(): Promise<FuncaoEpi[]> {
  const editadas = await obterListaEditadaMatriz();
  return MATRIZ_EPI.map((f) => ({
    funcao: f.funcao,
    epis: editadas.get(f.funcao) ?? f.epis,
  }));
}

/** RH edita a lista de EPIs de uma função (adicionar, remover ou renomear qualquer item). */
export async function atualizarEpisExtrasDaFuncao(funcao: string, epis: string[]): Promise<void> {
  if (!MATRIZ_EPI.some((f) => f.funcao === funcao)) throw new Error("Função não encontrada na matriz de EPI.");
  const limpos = [...new Set(epis.map((e) => e.trim()).filter(Boolean))];
  await sstQuery(
    `INSERT INTO sst_matriz_epi_extra (funcao, epis, atualizado_em) VALUES ($1, $2, now())
       ON CONFLICT (funcao) DO UPDATE SET epis = EXCLUDED.epis, atualizado_em = now()`,
    [funcao, limpos],
  );
}

/**
 * Usa o MESMO cadastro do Quadro de Colaboradores — não uma base à parte. As
 * tabelas do SST (sst_entregas_epi etc.) vivem no mesmo banco hoje e
 * referenciam `colaboradores` direto, sem espelho.
 */
export async function listarColaboradoresParaEpi(): Promise<ColaboradorEpi[]> {
  const [todos, ultimasEntregas, extras, fichasAguardando] = await Promise.all([
    listarColaboradores(),
    // Só a entrega mais recente de cada EPI vale para o vencimento: uma nova entrega
    // do mesmo EPI substitui a anterior (por data de entrega; empate, a última lançada).
    sstQuery<{ colab_id: string; epi: string; data_troca: string }>(
      `SELECT DISTINCT ON (colab_id, epi) colab_id, epi, data_troca
         FROM sst_entregas_epi ORDER BY colab_id, epi, to_date(NULLIF(data_entrega, ''), 'DD/MM/YYYY') DESC NULLS LAST, created_at DESC`,
    ),
    obterListaEditadaMatriz(),
    sstQuery<{ colab_id: string }>(
      `SELECT DISTINCT colab_id FROM sst_fichas_epi
         WHERE NOT (status = 'assinada' OR assinatura_storage_path IS NOT NULL)`,
    ),
  ]);
  const trocaPorColaborador = new Map<number, Map<string, string>>();
  for (const e of ultimasEntregas) {
    const id = Number(e.colab_id);
    const mapa = trocaPorColaborador.get(id) ?? new Map<string, string>();
    mapa.set(e.epi, e.data_troca);
    trocaPorColaborador.set(id, mapa);
  }
  const idsAguardando = new Set(fichasAguardando.map((f) => Number(f.colab_id)));

  return todos
    .filter((c) => c.status !== "desligado")
    .map((c) => {
      const funcao = funcaoDaMatriz(c.cargo, c.departamento);
      const episObrigatorios = funcao ? (extras.get(funcao.funcao) ?? funcao.epis) : [];
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
        aguardandoAssinatura: idsAguardando.has(c.id),
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
  { equip: "Cartucho Filtro RC203 para CG306", valor: 31, ca: "" },
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
  // valor IS NOT NULL: uma linha pode existir só pra guardar o CA de um extra, sem preço ainda.
  const precos = await sstQuery<{ equip: string; valor: number }>(
    "SELECT equip, valor::float8 AS valor FROM sst_epi_precos WHERE valor IS NOT NULL",
  );
  return new Map<string, number>([
    ...EPI_CATALOGO.map((c) => [c.equip, c.valor] as const),
    ...precos.map((p) => [p.equip, p.valor] as const),
  ]);
}

/** CA que o RH informou pra um EPI extra (o catálogo estático já tem CA fixo pros seus itens). */
export async function obterCaExtraEpi(): Promise<Map<string, string>> {
  const linhas = await sstQuery<{ equip: string; ca: string }>(
    "SELECT equip, ca FROM sst_epi_precos WHERE ca IS NOT NULL AND ca <> ''",
  );
  return new Map(linhas.map((l) => [l.equip, l.ca]));
}

/**
 * RH informa o CA de um EPI extra ao cadastrá-lo na matriz — pra ele entrar
 * "validado" na Gestão de EPI: aparece com CA certo em Custo e Valores e já
 * vem preenchido ao registrar entrega, sem precisar digitar de novo toda vez.
 */
export async function definirCaEpi(equip: string, ca: string): Promise<void> {
  const limpo = ca.trim();
  await sstQuery(
    `INSERT INTO sst_epi_precos (equip, ca) VALUES ($1, $2)
       ON CONFLICT (equip) DO UPDATE SET ca = EXCLUDED.ca`,
    [equip, limpo || null],
  );
}

/** RH edita o valor unitário de um EPI em Custo e Valores — sobrescreve o catálogo estático (ou a média das entregas). */
export async function definirPrecoEpi(equip: string, valor: number): Promise<void> {
  await sstQuery(
    `INSERT INTO sst_epi_precos (equip, valor) VALUES ($1, $2)
       ON CONFLICT (equip) DO UPDATE SET valor = EXCLUDED.valor`,
    [equip, valor],
  );
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
 * Custos de EPI: quanto foi ENTREGUE de fato (sst_entregas_epi) NO ANO
 * CORRENTE — entrega de anos anteriores não entra nem nos trimestres nem na
 * planilha por EPI, pra tudo bater com a mesma base. "Valor total" é o que
 * foi de fato pago (soma do valor_unit gravado em cada entrega, histórico —
 * não muda se o preço do catálogo for editado depois); "Valor unitário" é a
 * média paga quando já teve entrega, ou o preço vigente do catálogo como
 * estimativa quando o EPI ainda não foi entregue este ano.
 */
export async function obterCustosEpi(): Promise<DashboardCustosEpi> {
  const anoAtual = new Date().getFullYear();

  const [todasEntregas, precoPorEpi, caExtra] = await Promise.all([
    sstQuery<LinhaEntregaEpi>(
      "SELECT epi, qtd, valor_unit::float8 AS valor_unit, data_entrega FROM sst_entregas_epi",
    ),
    obterPrecosEpi(),
    obterCaExtraEpi(),
  ]);
  const entregas = todasEntregas.filter((e) => mesEAnoBr(e.data_entrega)?.ano === anoAtual);

  const trimestres: CustoTrimestre[] = ROTULO_TRIMESTRE.map((label) => ({ label, quantidade: 0, valor: 0 }));
  for (const e of entregas) {
    const data = mesEAnoBr(e.data_entrega)!;
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

  const nomesEpi = new Set<string>([...precoPorEpi.keys(), ...somaQtdPorEpi.keys(), ...caExtra.keys()]);
  const linhas: LinhaCustoEpi[] = [...nomesEpi]
    .map((epi) => {
      const quantidade = somaQtdPorEpi.get(epi) ?? 0;
      const valorTotal = somaValorPorEpi.get(epi) ?? 0;
      const valorUnitario = quantidade > 0 ? valorTotal / quantidade : (precoPorEpi.get(epi) ?? 0);
      const ca = EPI_CATALOGO.find((c) => c.equip === epi)?.ca ?? caExtra.get(epi) ?? "";
      return { epi, ca, quantidade, valorUnitario, valorTotal };
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

/** RH edita o valor unitário de um item de fardamento em Custo e Valores. */
export async function definirPrecoFardamento(tipo: string, valor: number): Promise<void> {
  await sstQuery(
    `INSERT INTO sst_fardamento_precos (tipo, valor) VALUES ($1, $2)
       ON CONFLICT (tipo) DO UPDATE SET valor = EXCLUDED.valor`,
    [tipo, valor],
  );
}

export interface LinhaCustoFardamento {
  tipo: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

/**
 * Fardamento entregue (sst_fardamento_entregas) NO ANO CORRENTE, mesmo
 * critério de obterCustosEpi: "valor total" é o histórico realmente pago,
 * "valor unitário" é a média paga (ou o preço vigente, se nunca entregue
 * este ano).
 */
export async function obterCustosFardamento(): Promise<LinhaCustoFardamento[]> {
  const anoAtual = new Date().getFullYear();
  const [todasEntregas, precoPorTipo] = await Promise.all([
    sstQuery<{ tipo: string; qtd: number; valor_unit: number; data_entrega: string }>(
      "SELECT tipo, qtd, valor_unit::float8 AS valor_unit, data_entrega FROM sst_fardamento_entregas",
    ),
    obterPrecosFardamento(),
  ]);
  const entregas = todasEntregas.filter((e) => mesEAnoBr(e.data_entrega)?.ano === anoAtual);

  const qtdPorTipo = new Map<string, number>();
  const valorPorTipo = new Map<string, number>();
  for (const e of entregas) {
    qtdPorTipo.set(e.tipo, (qtdPorTipo.get(e.tipo) ?? 0) + e.qtd);
    valorPorTipo.set(e.tipo, (valorPorTipo.get(e.tipo) ?? 0) + e.qtd * e.valor_unit);
  }

  const ordem = new Map(FARDAMENTO_CATALOGO.map((c, i) => [c.tipo, i]));
  return [...new Set([...precoPorTipo.keys(), ...qtdPorTipo.keys()])]
    .map((tipo) => {
      const quantidade = qtdPorTipo.get(tipo) ?? 0;
      const valorTotal = valorPorTipo.get(tipo) ?? 0;
      const valorUnitario = quantidade > 0 ? valorTotal / quantidade : (precoPorTipo.get(tipo) ?? 0);
      return { tipo, quantidade, valorUnitario, valorTotal };
    })
    .sort((a, b) => (ordem.get(a.tipo) ?? 99) - (ordem.get(b.tipo) ?? 99) || a.tipo.localeCompare(b.tipo, "pt-BR"));
}
