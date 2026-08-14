import "server-only";
import type { LinhaPlanilha } from "./spreadsheet";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LinhaExtrasImportada {
  codigo: string | null;
  nomeColaborador: string;
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  premiacao: number | null;
  outrosCustos: number | null;
}

type CampoExtra = "codigo" | "nomeColaborador" | "vm" | "odontologico" | "solides" | "flash" | "bonificacao" | "premiacao";

const SINONIMOS: Record<CampoExtra, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeColaborador: ["nome do colaborador", "colaborador", "nome", "empregado", "funcionario"],
  vm: ["vm", "vale mercado", "vale refeicao"],
  odontologico: ["odontologico", "odonto", "plano odontologico"],
  solides: ["solides"],
  flash: ["flash"],
  bonificacao: ["bonificacao", "bonificacao fixa"],
  premiacao: ["premiacao", "premiacao do mes", "premio"],
};

// Colunas que fazem parte do núcleo calculado (nunca vêm de planilha importada) — ignoradas ao
// decidir o que vira "outros custos", para não somar salário/INSS/FGTS/VT/VA como custo extra.
const SINONIMOS_NUCLEO = [
  "salario",
  "salario base",
  "inss",
  "irrf",
  "fgts",
  "provisao",
  "provisao 13",
  "total de encargos",
  "total encargos",
  "vt",
  "vale transporte",
  "va",
  "vale alimentacao",
  "custo total",
  "cargo",
  "departamento",
  "setor",
  "vinculo",
];

function mapearCabecalhos(cabecalhos: string[]): { mapa: Partial<Record<CampoExtra, string>>; naoReconhecidas: string[] } {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  // Comparação por palavra inteira (não substring solta) — "va" não pode casar dentro de "vale cultura".
  const bate = (norm: string, sinonimo: string) => norm === sinonimo || new RegExp(`\\b${sinonimo}\\b`).test(norm);

  const mapa: Partial<Record<CampoExtra, string>> = {};
  (Object.keys(SINONIMOS) as CampoExtra[]).forEach((campo) => {
    const encontrado = normalizados.find((c) => SINONIMOS[campo].some((s) => bate(c.norm, s)));
    if (encontrado) mapa[campo] = encontrado.original;
  });

  const usadas = new Set(Object.values(mapa));
  const naoReconhecidas = normalizados
    .filter((c) => !usadas.has(c.original) && !SINONIMOS_NUCLEO.some((s) => bate(c.norm, s)))
    .map((c) => c.original);

  return { mapa, naoReconhecidas };
}

function paraNumeroOuNulo(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ConversaoExtras {
  itens: LinhaExtrasImportada[];
  colunasReconhecidas: string[];
  colunasOutros: string[];
  descartadas: { linha: number; motivo: string }[];
}

/**
 * Identifica cada verba pelo cabeçalho da coluna (não pela posição) — colunas
 * que não correspondem a nenhuma verba conhecida (nem ao núcleo calculado:
 * salário, INSS, FGTS, VT, VA etc., que nunca vêm de planilha) somam juntas
 * como "Outros custos" da linha, nunca são descartadas.
 */
export function converterExtrasImportadas(cabecalhos: string[], linhas: LinhaPlanilha[]): ConversaoExtras {
  const { mapa, naoReconhecidas } = mapearCabecalhos(cabecalhos);
  if (!mapa.nomeColaborador) {
    throw new Error('Não foi possível identificar a coluna do colaborador (ex.: "Nome do colaborador").');
  }

  const itens: LinhaExtrasImportada[] = [];
  const descartadas: ConversaoExtras["descartadas"] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const nomeColaborador = String(linha[mapa.nomeColaborador!] ?? "").trim();
    if (!nomeColaborador) {
      descartadas.push({ linha: numeroLinha, motivo: "Nome do colaborador ausente." });
      return;
    }

    const outrosCustosSoma = naoReconhecidas.reduce((soma, coluna) => {
      const valor = paraNumeroOuNulo(linha[coluna]);
      return soma + (valor ?? 0);
    }, 0);
    const temOutros = naoReconhecidas.some((coluna) => paraNumeroOuNulo(linha[coluna]) !== null);

    itens.push({
      codigo: mapa.codigo ? String(linha[mapa.codigo] ?? "").trim() || null : null,
      nomeColaborador,
      vm: mapa.vm ? paraNumeroOuNulo(linha[mapa.vm]) : null,
      odontologico: mapa.odontologico ? paraNumeroOuNulo(linha[mapa.odontologico]) : null,
      solides: mapa.solides ? paraNumeroOuNulo(linha[mapa.solides]) : null,
      flash: mapa.flash ? paraNumeroOuNulo(linha[mapa.flash]) : null,
      bonificacao: mapa.bonificacao ? paraNumeroOuNulo(linha[mapa.bonificacao]) : null,
      premiacao: mapa.premiacao ? paraNumeroOuNulo(linha[mapa.premiacao]) : null,
      outrosCustos: temOutros ? outrosCustosSoma : null,
    });
  });

  return {
    itens,
    colunasReconhecidas: Object.values(mapa) as string[],
    colunasOutros: naoReconhecidas,
    descartadas,
  };
}
