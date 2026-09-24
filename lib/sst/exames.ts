import "server-only";
import { listarColaboradores, type Vinculo } from "@/lib/db/colaboradores";
import { sstQuery } from "./db";
import { CATALOGO_EXAMES_OCUPACIONAIS } from "./domain";

/**
 * Funções da matriz — as MESMAS 10 funções da Matriz de EPI (mesmos cargos,
 * mesma empresa): reaproveita só os NOMES, como ponto de partida pro RH
 * montar quais exames e quais riscos cada uma tem. Nasce tudo vazio de
 * propósito — não existe mais o JSON estático do Portal SST antigo com essa
 * informação (só o catálogo de exames sobrou, ver domain.ts), então inventar
 * "função X exige exame Y" seria dado de segurança do trabalho fabricado.
 */
export const FUNCOES_MATRIZ_EXAMES = [
  "Assistente Logístico",
  "Auxiliar De Produção",
  "Auxiliar De Produção I",
  "Auxiliar De Produção II",
  "Auxiliar De Produção III",
  "Auxiliar De Serviços Gerais",
  "Inspetora Da Qualidade",
  "Líder De Manutenção",
  "Supervisor (a) De Produção",
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

// ---------- Matriz Ocupacional (função → riscos) ----------

export type TipoRisco = "fisico" | "quimico" | "biologico" | "ergonomico";

export const ROTULO_TIPO_RISCO: Record<TipoRisco, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
};

export interface RiscoOcupacional {
  tipo: TipoRisco;
  descricao: string;
}

export interface FuncaoRiscos {
  funcao: string;
  riscos: RiscoOcupacional[];
}

async function obterRiscosPorFuncao(): Promise<Map<string, RiscoOcupacional[]>> {
  const linhas = await sstQuery<{ funcao: string; riscos: RiscoOcupacional[] }>("SELECT funcao, riscos FROM sst_matriz_riscos_funcao");
  return new Map(linhas.map((l) => [l.funcao, l.riscos]));
}

export async function obterMatrizRiscos(): Promise<FuncaoRiscos[]> {
  const mapa = await obterRiscosPorFuncao();
  return FUNCOES_MATRIZ_EXAMES.map((funcao) => ({ funcao, riscos: mapa.get(funcao) ?? [] }));
}

export async function atualizarRiscosDaFuncao(funcao: string, riscos: RiscoOcupacional[]): Promise<void> {
  if (!FUNCOES_MATRIZ_EXAMES.includes(funcao)) throw new Error("Função não encontrada na matriz.");
  const limpos = riscos.map((r) => ({ tipo: r.tipo, descricao: r.descricao.trim() })).filter((r) => r.descricao);
  await sstQuery(
    `INSERT INTO sst_matriz_riscos_funcao (funcao, riscos, atualizado_em) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (funcao) DO UPDATE SET riscos = EXCLUDED.riscos, atualizado_em = now()`,
    [funcao, JSON.stringify(limpos)],
  );
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
}

/**
 * Usa o MESMO cadastro do Quadro de Colaboradores — não uma base à parte.
 * Ainda não existe um registro de exame REALIZADO por colaborador (esse é o
 * próximo passo, quando a "ficha" de exame for construída, no molde da ficha
 * de EPI); por enquanto isto só mostra quantos exames a função exige.
 */
export async function listarColaboradoresParaExames(): Promise<ColaboradorExame[]> {
  const [todos, mapaExames] = await Promise.all([listarColaboradores(), obterExamesPorFuncao()]);
  return todos
    .filter((c) => c.status !== "desligado")
    .map((c) => {
      const funcao = funcaoCorrespondente(c.cargo, c.departamento, FUNCOES_MATRIZ_EXAMES);
      return {
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        departamento: c.departamento,
        vinculo: c.vinculo,
        email: c.email,
        funcaoMatriz: funcao,
        examesObrigatorios: funcao ? (mapaExames.get(funcao) ?? []) : [],
      };
    });
}

// ---------- Custo e Valores (catálogo de exames) ----------

export interface LinhaCustoExame {
  codigo: string;
  nome: string;
  cargos: number;
  valorUnitario: number;
  valorTotal: number;
}

/** Preço vigente de cada exame: catálogo estático (domain.ts), sobrescrito pelo que estiver em sst_exame_precos. */
export async function obterPrecosExames(): Promise<Map<string, number>> {
  const precos = await sstQuery<{ codigo: string; valor: number }>("SELECT codigo, valor::float8 AS valor FROM sst_exame_precos");
  return new Map<string, number>([
    ...CATALOGO_EXAMES_OCUPACIONAIS.map((c) => [c.codigo, c.valor] as const),
    ...precos.map((p) => [p.codigo, p.valor] as const),
  ]);
}

/** Valor estimado (não realizado — ainda não existe registro de exame feito): preço × quantos cargos precisam dele. */
export async function obterCustosExames(): Promise<LinhaCustoExame[]> {
  const precos = await obterPrecosExames();
  return CATALOGO_EXAMES_OCUPACIONAIS.map((c) => {
    const valorUnitario = precos.get(c.codigo) ?? c.valor;
    return { codigo: c.codigo, nome: c.nome, cargos: c.cargos, valorUnitario, valorTotal: valorUnitario * c.cargos };
  }).sort((a, b) => b.valorTotal - a.valorTotal);
}
