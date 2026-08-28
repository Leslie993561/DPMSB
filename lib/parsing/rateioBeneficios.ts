import "server-only";
import type { LinhaPlanilha } from "./spreadsheet";
import type { LinhaImportacaoRateio } from "../db/beneficiosRateio";

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

type CampoRateio = "codigo" | "nomeColaborador" | "valeTransporte" | "valeAlimentacao" | "variaveis";

const SINONIMOS: Record<CampoRateio, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeColaborador: ["nome do colaborador", "colaborador", "nome", "empregado", "funcionario"],
  valeTransporte: ["transporte", "vale transporte", "vt", "vm"],
  valeAlimentacao: ["alimentacao", "vale alimentacao", "va", "vr"],
  variaveis: ["variaveis", "variavel", "aniversario", "premiacao"],
};

function mapearCabecalhos(cabecalhos: string[]): Partial<Record<CampoRateio, string>> {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  const bate = (norm: string, sinonimo: string) => norm === sinonimo || new RegExp(`\\b${sinonimo}\\b`).test(norm);

  const mapa: Partial<Record<CampoRateio, string>> = {};
  (Object.keys(SINONIMOS) as CampoRateio[]).forEach((campo) => {
    const encontrado = normalizados.find((c) => SINONIMOS[campo].some((s) => bate(c.norm, s)));
    if (encontrado) mapa[campo] = encontrado.original;
  });
  return mapa;
}

function paraNumeroOuNulo(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ConversaoRateio {
  itens: LinhaImportacaoRateio[];
  /** Colunas que o portal reconheceu no arquivo, pelo nome do cabeçalho. */
  colunasReconhecidas: string[];
  /** Cabeçalhos do arquivo que não corresponderam a nenhum campo. */
  colunasIgnoradas: string[];
  descartadas: { linha: number; motivo: string }[];
}

/** Casamento por cabeçalho de coluna (não posição) — Transporte e Alimentação identificados pelo nome da coluna. */
export function converterRateioImportado(cabecalhos: string[], linhas: LinhaPlanilha[]): ConversaoRateio {
  const mapa = mapearCabecalhos(cabecalhos);
  // Sem isto, uma coluna com nome inesperado era simplesmente ignorada e a
  // importação dizia "aplicadas: N" sem nenhum sinal de que o valor não entrou.
  const usadas = new Set(Object.values(mapa).filter(Boolean) as string[]);
  const colunasReconhecidas = Array.from(usadas);
  const colunasIgnoradas = cabecalhos.filter((c) => c && !usadas.has(c));

  if (!mapa.nomeColaborador) {
    throw new Error('Não foi possível identificar a coluna do colaborador (ex.: "Nome do colaborador").');
  }

  const itens: LinhaImportacaoRateio[] = [];
  const descartadas: ConversaoRateio["descartadas"] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const nomeColaborador = String(linha[mapa.nomeColaborador!] ?? "").trim();
    if (!nomeColaborador) {
      descartadas.push({ linha: numeroLinha, motivo: "Nome do colaborador ausente." });
      return;
    }

    itens.push({
      codigo: mapa.codigo ? String(linha[mapa.codigo] ?? "").trim() || null : null,
      nomeColaborador,
      valeTransporte: mapa.valeTransporte ? paraNumeroOuNulo(linha[mapa.valeTransporte]) : null,
      valeAlimentacao: mapa.valeAlimentacao ? paraNumeroOuNulo(linha[mapa.valeAlimentacao]) : null,
      variaveis: mapa.variaveis ? paraNumeroOuNulo(linha[mapa.variaveis]) : null,
    });
  });

  return { itens, colunasReconhecidas, colunasIgnoradas, descartadas };
}
