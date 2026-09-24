import "server-only";
import { randomUUID } from "node:crypto";
import { buscarColaborador, listarColaboradores, type Vinculo } from "@/lib/db/colaboradores";
import { sstQuery, sstTransacao } from "./db";
import { CATALOGO_EXAMES_OCUPACIONAIS } from "./domain";

/**
 * As 31 funções da Matriz Ocupacional real da empresa (Leslie repassou a
 * planilha função → exame). Bem mais ampla que a Matriz de EPI (10 funções,
 * só quem usa EPI) porque exame ocupacional é para todo mundo, não só o
 * chão de fábrica.
 */
export const FUNCOES_MATRIZ_EXAMES = [
  "Analista Administrativo",
  "Analista De Engenharia",
  "Analista De Engenharia De Processo",
  "Analista De Engenharia De Produtos",
  "Analista De Engenharia De Projetos",
  "Analista De Gente E Gestão",
  "Analista De Melhoria Contínua",
  "Analista De Pcp",
  "Analista De Qualidade",
  "Analista Financeiro",
  "Assistente De Controle Da Qualidade",
  "Assistente De Operações De Vendas",
  "Assistente De Pcp",
  "Assistente De Rh",
  "Assistente De Tecnologia Da Informação",
  "Assistente De Vendas",
  "Assistente Logístico",
  "Auxiliar De Produção",
  "Auxiliar De Produção I",
  "Auxiliar De Produção II",
  "Auxiliar De Produção III",
  "Auxiliar De Serviços Gerais",
  "Coordenador (a) De Garantia Da Qualidade E Assuntos Regulatórios",
  "Estagiário De Projetos",
  "Inspetora Da Qualidade",
  "Jovem Aprendiz Administrativo",
  "Jovem Aprendiz De Logística",
  "Líder De Manutenção",
  "Supervisor (a) De Produção",
  "Supervisor De Vendas",
  "Técnico Em Manutenção Geral",
];

const PALAVRAS_IGNORADAS = new Set(["de", "da", "do", "das", "dos", "em", "e", "a", "i", "ii", "iii"]);

/** Mesmo algoritmo de casamento cargo/setor → função de lib/sst/epi.ts, parametrizado pela lista de funções. */
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

function funcaoCorrespondente(cargo: string | null, departamento: string | null, funcoes: string[]): string | null {
  const doCargo = radicais(cargo);
  if (doCargo.length === 0) return null;
  const doColaborador = new Set([...doCargo, ...radicais(departamento)]);

  let melhor: { funcao: string; cobertura: number; tamanho: number } | null = null;
  for (const funcao of funcoes) {
    const daFuncao = radicais(funcao);
    if (!doCargo.every((r) => daFuncao.includes(r))) continue;
    const cobertura = daFuncao.filter((r) => doColaborador.has(r)).length / daFuncao.length;
    if (cobertura < 0.6) continue;
    if (!melhor || cobertura > melhor.cobertura || (cobertura === melhor.cobertura && funcao.length < melhor.tamanho)) {
      melhor = { funcao, cobertura, tamanho: funcao.length };
    }
  }
  return melhor?.funcao ?? null;
}

// ---------- Matriz por função (função → exames obrigatórios) ----------

export interface FuncaoExames {
  funcao: string;
  exames: string[];
}

async function obterExamesPorFuncao(): Promise<Map<string, string[]>> {
  const linhas = await sstQuery<{ funcao: string; exames: string[] }>("SELECT funcao, exames FROM sst_matriz_exames_funcao");
  return new Map(linhas.map((l) => [l.funcao, l.exames]));
}

export async function obterMatrizExames(): Promise<FuncaoExames[]> {
  const mapa = await obterExamesPorFuncao();
  return FUNCOES_MATRIZ_EXAMES.map((funcao) => ({ funcao, exames: mapa.get(funcao) ?? [] }));
}

export async function atualizarExamesDaFuncao(funcao: string, exames: string[]): Promise<void> {
  if (!FUNCOES_MATRIZ_EXAMES.includes(funcao)) throw new Error("Função não encontrada na matriz.");
  const limpos = [...new Set(exames.map((e) => e.trim()).filter(Boolean))];
  await sstQuery(
    `INSERT INTO sst_matriz_exames_funcao (funcao, exames, atualizado_em) VALUES ($1, $2, now())
       ON CONFLICT (funcao) DO UPDATE SET exames = EXCLUDED.exames, atualizado_em = now()`,
    [funcao, limpos],
  );
}

// ---------- Matriz Ocupacional (setor → cargo → riscos/EPIs/exames) ----------

/** Uma linha de risco do PGR: agente (ex.: "Ruído continuo ou intermitente") e frequência de exposição. */
export interface RiscoCargo {
  /** Grupo do agente: "ACIDENTES / MECÂNICOS", "ERGONÔMICOS", "FÍSICOS", "QUÍMICOS", "BIOLÓGICOS". */
  tipo: string;
  descricao: string;
  frequencia: string;
}

export interface CargoOcupacional {
  cargo: string;
  cbo: string;
  setor: string;
  riscos: RiscoCargo[];
  epis: string[];
  /** Nomes dos exames — mesmo catálogo de domain.ts; periodicidade vem de lá, não é repetida aqui. */
  exames: string[];
  /** Quantos colaboradores reais do Quadro têm esse cargo neste departamento. */
  totalColaboradores: number;
  /** Nenhum cargo cadastrado (planilha de riscos) deu match — ainda não tem risco/EPI/exame levantado para este cargo real. */
  semDadosCadastrados: boolean;
}

export interface SetorOcupacional {
  setor: string;
  cargos: CargoOcupacional[];
}

interface CargoCadastrado {
  cargo: string;
  cbo: string;
  setor: string;
  riscos: RiscoCargo[];
  epis: string[];
  exames: string[];
}

async function obterCargosCadastrados(): Promise<CargoCadastrado[]> {
  return sstQuery<CargoCadastrado>(
    "SELECT cargo, cbo, setor, riscos, epis, exames FROM sst_cargos_ocupacionais ORDER BY cargo",
  );
}

/**
 * Matriz Ocupacional agrupada pelo Departamento e Cargo REAIS do Quadro de
 * Colaboradores — não pela planilha de riscos isolada, porque "os cargos que
 * envolvem cada setor dependem do que for colocado no quadro" (ela muda
 * conforme contratações). O risco/EPI/exame de cada cargo real vem do melhor
 * match (mesmo algoritmo de radical usado pra Matriz por Função) contra a
 * planilha de riscos (scripts/seed-cargos-ocupacionais.js); sem match
 * confiável, o cargo aparece mesmo assim, só marcado como sem dados — nunca
 * inventamos risco pra fechar a lista.
 */
export async function obterCargosOcupacionais(): Promise<SetorOcupacional[]> {
  const [colaboradores, cadastrados] = await Promise.all([listarColaboradores(), obterCargosCadastrados()]);
  const nomesCadastrados = cadastrados.map((c) => c.cargo);

  const porDepartamento = new Map<string, Map<string, number>>();
  for (const c of colaboradores) {
    if (!c.cargo || !c.departamento) continue;
    const porCargo = porDepartamento.get(c.departamento) ?? new Map<string, number>();
    porCargo.set(c.cargo, (porCargo.get(c.cargo) ?? 0) + 1);
    porDepartamento.set(c.departamento, porCargo);
  }

  return [...porDepartamento.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([departamento, porCargo]) => ({
      setor: departamento,
      cargos: [...porCargo.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cargoReal, totalColaboradores]) => {
          const nomeMatch = funcaoCorrespondente(cargoReal, departamento, nomesCadastrados);
          const dados = nomeMatch ? cadastrados.find((c) => c.cargo === nomeMatch) : undefined;
          return {
            cargo: cargoReal,
            cbo: dados?.cbo ?? "",
            setor: departamento,
            riscos: dados?.riscos ?? [],
            epis: dados?.epis ?? [],
            exames: dados?.exames ?? [],
            totalColaboradores,
            semDadosCadastrados: !dados,
          };
        }),
    }));
}

// ---------- Vencimento (periodicidade do catálogo × última realização) ----------

const PERIODICIDADE_POR_EXAME = new Map(CATALOGO_EXAMES_OCUPACIONAIS.map((c) => [c.nome, c.periodicidade]));

/** "12 meses" → 12; "Sem periódico"/vazio → null (feito uma vez, nunca vence de novo). */
function mesesDaPeriodicidade(exame: string): number | null {
  const m = /^(\d+)\s*mes/i.exec((PERIODICIDADE_POR_EXAME.get(exame) ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** "DD/MM/AAAA" + N meses → "DD/MM/AAAA". */
function somarMeses(dataBr: string, meses: number): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1 + meses, Number(m[1]));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Próxima data prevista pra um exame, a partir de quando foi feito — null se o exame não repete ("Sem periódico"). */
function calcularDataPrevista(exame: string, dataRealizacaoBr: string): string | null {
  const meses = mesesDaPeriodicidade(exame);
  return meses ? somarMeses(dataRealizacaoBr, meses) : null;
}

/** "DD/MM/AAAA" já passou da data de hoje? */
function dataPassou(dataBr: string, hoje: Date): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  if (!m) return false;
  const alvo = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return alvo < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

/**
 * Vencido = nunca foi feito, OU foi feito mas a data prevista (periodicidade)
 * já passou. Exame sem periodicidade ("Sem periódico") feito uma vez nunca
 * vence de novo.
 */
function exameVencido(dataPrevista: string | null | undefined, feito: boolean, hoje: Date): boolean {
  if (!feito) return true;
  if (!dataPrevista) return false;
  return dataPassou(dataPrevista, hoje);
}

/** Última realização de cada exame do colaborador (uma nova realização substitui a anterior). */
async function obterUltimasRealizacoes(colaboradorId: number): Promise<Map<string, { dataRealizacao: string; dataPrevista: string | null }>> {
  const linhas = await sstQuery<{ exame: string; data_realizacao: string; data_prevista: string | null }>(
    `SELECT DISTINCT ON (exame) exame, data_realizacao, data_prevista FROM sst_exames_realizados
       WHERE colab_id = $1 ORDER BY exame, to_date(NULLIF(data_realizacao, ''), 'DD/MM/YYYY') DESC NULLS LAST, created_at DESC`,
    [colaboradorId],
  );
  return new Map(linhas.map((l) => [l.exame, { dataRealizacao: l.data_realizacao, dataPrevista: l.data_prevista }]));
}

export interface ExameVencido {
  exame: string;
  /** Data em que a periodicidade estourou — null se o exame nunca foi realizado. */
  dataVencimento: string | null;
}

/** Exames obrigatórios da função que estão vencidos (nunca feitos ou fora da periodicidade) — o que entra no checklist de "Anexar exame". */
function calcularVencidos(
  examesObrigatorios: string[],
  realizados: Map<string, { dataPrevista: string | null }>,
  hoje = new Date(),
): ExameVencido[] {
  return examesObrigatorios
    .filter((exame) => {
      const info = realizados.get(exame);
      return exameVencido(info?.dataPrevista, Boolean(info), hoje);
    })
    .map((exame) => ({ exame, dataVencimento: realizados.get(exame)?.dataPrevista ?? null }));
}

// ---------- Colaboradores (mesmo cadastro do Quadro, igual Gestão de EPI) ----------

export interface ColaboradorExame {
  id: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: Vinculo | null;
  email: string | null;
  funcaoMatriz: string | null;
  examesObrigatorios: string[];
  /** Quantos dos obrigatórios estão vencidos (nunca feitos ou fora da periodicidade) — mostrado como chip na lista. */
  examesVencidos: number;
}

/**
 * Usa o MESMO cadastro do Quadro de Colaboradores — não uma base à parte.
 * "Vencidos" já considera o histórico real de sst_exames_realizados (ficha de
 * exame, ver mais abaixo) — igual à situação de EPI.
 */
export async function listarColaboradoresParaExames(): Promise<ColaboradorExame[]> {
  const [todos, mapaExames, ultimasRealizacoes] = await Promise.all([
    listarColaboradores(),
    obterExamesPorFuncao(),
    sstQuery<{ colab_id: string; exame: string; data_prevista: string | null }>(
      `SELECT DISTINCT ON (colab_id, exame) colab_id, exame, data_prevista FROM sst_exames_realizados
         ORDER BY colab_id, exame, to_date(NULLIF(data_realizacao, ''), 'DD/MM/YYYY') DESC NULLS LAST, created_at DESC`,
    ),
  ]);
  const realizadosPorColaborador = new Map<number, Map<string, { dataPrevista: string | null }>>();
  for (const r of ultimasRealizacoes) {
    const id = Number(r.colab_id);
    const mapa = realizadosPorColaborador.get(id) ?? new Map<string, { dataPrevista: string | null }>();
    mapa.set(r.exame, { dataPrevista: r.data_prevista });
    realizadosPorColaborador.set(id, mapa);
  }

  const hoje = new Date();
  return todos
    .filter((c) => c.status !== "desligado")
    .map((c) => {
      const funcao = funcaoCorrespondente(c.cargo, c.departamento, FUNCOES_MATRIZ_EXAMES);
      const examesObrigatorios = funcao ? (mapaExames.get(funcao) ?? []) : [];
      const vencidos = calcularVencidos(examesObrigatorios, realizadosPorColaborador.get(c.id) ?? new Map(), hoje);
      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        departamento: c.departamento,
        vinculo: c.vinculo,
        email: c.email,
        funcaoMatriz: funcao,
        examesObrigatorios,
        examesVencidos: vencidos.length,
      };
    });
}

// ---------- Ficha de exame ocupacional (ASO) ----------

export const TIPOS_ASO = [
  { valor: "admissional", label: "Admissional" },
  { valor: "periodico", label: "Periódico" },
  { valor: "retorno", label: "Retorno ao Trabalho" },
  { valor: "demissional", label: "Demissional" },
];

export interface NovaFichaExame {
  colaboradorId: number;
  tipoAso: string;
  /** Um item por exame marcado — todos com a MESMA data de realização (mesmo atendimento). */
  exames: { exame: string; dataRealizacao: string }[];
  anexoUrl?: string | null;
  anexoNome?: string | null;
}

export interface ItemFichaExame {
  exame: string;
  codigo: string;
  dataRealizacao: string;
  /** Próxima data prevista pela periodicidade — null se o exame não repete ("Sem periódico"). */
  dataVencimento: string | null;
}

export interface FichaExameResumo {
  id: string;
  tipoAso: string;
  dataRealizacao: string;
  exames: string[];
  itens: ItemFichaExame[];
  anexoUrl: string | null;
  anexoNome: string | null;
}

/** Registra a ficha (comprovante) e os exames feitos naquele atendimento — data prevista calculada aqui, não vem da tela. */
export async function criarFichaExame(nova: NovaFichaExame, responsavel: string): Promise<{ fichaId: string }> {
  const colaborador = await buscarColaborador(nova.colaboradorId);
  if (!colaborador) throw new Error("Colaborador não encontrado no Quadro.");
  if (nova.exames.length === 0) throw new Error("Selecione ao menos um exame.");

  const fichaId = randomUUID();
  await sstTransacao(async (q) => {
    await q(
      `INSERT INTO sst_fichas_exame (id, colab_id, tipo_aso, anexo_url, anexo_nome, responsavel)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fichaId, colaborador.id, nova.tipoAso, nova.anexoUrl ?? null, nova.anexoNome ?? null, responsavel],
    );
    for (const item of nova.exames) {
      const dataPrevista = calcularDataPrevista(item.exame, item.dataRealizacao);
      await q(
        `INSERT INTO sst_exames_realizados (id, ficha_id, colab_id, exame, data_realizacao, data_prevista)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), fichaId, colaborador.id, item.exame, item.dataRealizacao, dataPrevista],
      );
    }
  });
  return { fichaId };
}

interface LinhaFichaExame {
  id: string;
  tipo_aso: string;
  anexo_url: string | null;
  anexo_nome: string | null;
}

const CODIGO_POR_EXAME = new Map(CATALOGO_EXAMES_OCUPACIONAIS.map((c) => [c.nome, c.codigo]));

/** Histórico de fichas do colaborador (uma linha por atendimento) — pro drawer da Gestão de Exames e a aba Documentos ASO do Quadro. */
export async function listarFichasExameDoColaborador(colaboradorId: number): Promise<FichaExameResumo[]> {
  const [fichas, itens] = await Promise.all([
    sstQuery<LinhaFichaExame>(
      "SELECT id, tipo_aso, anexo_url, anexo_nome FROM sst_fichas_exame WHERE colab_id = $1 ORDER BY created_at DESC",
      [colaboradorId],
    ),
    sstQuery<{ ficha_id: string; exame: string; data_realizacao: string; data_prevista: string | null }>(
      "SELECT ficha_id, exame, data_realizacao, data_prevista FROM sst_exames_realizados WHERE colab_id = $1 ORDER BY created_at",
      [colaboradorId],
    ),
  ]);
  const itensPorFicha = new Map<string, ItemFichaExame[]>();
  for (const i of itens) {
    const lista = itensPorFicha.get(i.ficha_id) ?? [];
    lista.push({
      exame: i.exame,
      codigo: CODIGO_POR_EXAME.get(i.exame) ?? "—",
      dataRealizacao: i.data_realizacao,
      dataVencimento: i.data_prevista,
    });
    itensPorFicha.set(i.ficha_id, lista);
  }
  return fichas.map((f) => {
    const itensDaFicha = itensPorFicha.get(f.id) ?? [];
    return {
      id: f.id,
      tipoAso: f.tipo_aso,
      dataRealizacao: itensDaFicha[0]?.dataRealizacao ?? "",
      exames: itensDaFicha.map((i) => i.exame),
      itens: itensDaFicha,
      anexoUrl: f.anexo_url,
      anexoNome: f.anexo_nome,
    };
  });
}

/** Exames obrigatórios da função que ainda estão vencidos — é o checklist de "Anexar exame ocupacional" (só o que falta, não a lista toda). */
export async function obterExamesVencidosDoColaborador(colaboradorId: number, examesObrigatorios: string[]): Promise<ExameVencido[]> {
  const realizados = await obterUltimasRealizacoes(colaboradorId);
  return calcularVencidos(examesObrigatorios, realizados);
}

export async function obterAnexoFichaExame(fichaId: string): Promise<{ url: string; nome: string | null } | null> {
  const [f] = await sstQuery<{ anexo_url: string | null; anexo_nome: string | null }>(
    "SELECT anexo_url, anexo_nome FROM sst_fichas_exame WHERE id = $1",
    [fichaId],
  );
  if (!f?.anexo_url) return null;
  return { url: f.anexo_url, nome: f.anexo_nome };
}

export async function excluirFichaExame(fichaId: string): Promise<boolean> {
  const apagadas = await sstQuery<{ id: string }>("DELETE FROM sst_fichas_exame WHERE id = $1 RETURNING id", [fichaId]);
  return apagadas.length > 0;
}

// ---------- Custo e Valores (catálogo de exames) ----------

export interface LinhaCustoExame {
  codigo: string;
  nome: string;
  cargos: number;
  valorUnitario: number;
  /** Previsto p/ o ano corrente (até 31/12): preço × quantos cargos precisam dele — 1 exame por cargo no ano. */
  valorEstimado: number;
  /** Já gasto de fato — sempre 0 por enquanto: não existe registro de exame REALIZADO neste módulo ainda. */
  valorRealizado: number;
}

/** Preço vigente de cada exame: catálogo estático (domain.ts), sobrescrito pelo que estiver em sst_exame_precos. */
export async function obterPrecosExames(): Promise<Map<string, number>> {
  const precos = await sstQuery<{ codigo: string; valor: number }>("SELECT codigo, valor::float8 AS valor FROM sst_exame_precos");
  return new Map<string, number>([
    ...CATALOGO_EXAMES_OCUPACIONAIS.map((c) => [c.codigo, c.valor] as const),
    ...precos.map((p) => [p.codigo, p.valor] as const),
  ]);
}

/** Estimativa pro ano corrente (até 31/12): preço × quantos cargos precisam dele. Realizado = exames de fato registrados este ano (sst_exames_realizados), no preço vigente. */
export async function obterCustosExames(): Promise<LinhaCustoExame[]> {
  const anoAtual = new Date().getFullYear();
  const [precos, realizados] = await Promise.all([
    obterPrecosExames(),
    sstQuery<{ exame: string; data_realizacao: string }>("SELECT exame, data_realizacao FROM sst_exames_realizados"),
  ]);
  const qtdRealizadaPorExame = new Map<string, number>();
  for (const r of realizados) {
    const ano = Number(r.data_realizacao.slice(6, 10));
    if (ano !== anoAtual) continue;
    qtdRealizadaPorExame.set(r.exame, (qtdRealizadaPorExame.get(r.exame) ?? 0) + 1);
  }

  return CATALOGO_EXAMES_OCUPACIONAIS.map((c) => {
    const valorUnitario = precos.get(c.codigo) ?? c.valor;
    const qtdRealizada = qtdRealizadaPorExame.get(c.nome) ?? 0;
    return {
      codigo: c.codigo,
      nome: c.nome,
      cargos: c.cargos,
      valorUnitario,
      valorEstimado: valorUnitario * c.cargos,
      valorRealizado: valorUnitario * qtdRealizada,
    };
  }).sort((a, b) => b.valorEstimado - a.valorEstimado);
}
