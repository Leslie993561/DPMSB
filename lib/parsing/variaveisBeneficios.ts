import "server-only";
import type { LinhaPlanilha } from "./spreadsheet";
import type { LinhaImportacaoVariavel } from "../db/beneficiosVariaveis";

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

type CampoVariavel = "codigo" | "nomeColaborador" | "transporte" | "mobilidade" | "alimentacao" | "motivo";

const SINONIMOS: Record<CampoVariavel, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeColaborador: ["nome do colaborador", "colaborador", "nome", "empregado", "funcionario"],
  transporte: ["transporte", "vale transporte", "vt"],
  mobilidade: ["mobilidade"],
  alimentacao: ["alimentacao", "vale alimentacao", "va", "vr", "refeicao"],
  motivo: ["motivo", "justificativa", "descricao"],
};

function mapearCabecalhos(cabecalhos: string[]): Partial<Record<CampoVariavel, string>> {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  const bate = (norm: string, sinonimo: string) => norm === sinonimo || new RegExp(`\\b${sinonimo}\\b`).test(norm);

  const mapa: Partial<Record<CampoVariavel, string>> = {};
  (Object.keys(SINONIMOS) as CampoVariavel[]).forEach((campo) => {
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

export interface ConversaoVariaveis {
  itens: LinhaImportacaoVariavel[];
  descartadas: { linha: number; motivo: string }[];
}

/** Casamento por cabeçalho de coluna — Transporte/Mobilidade/Alimentação/Motivo identificados pelo nome, não pela posição. */
export function converterVariaveisImportadas(cabecalhos: string[], linhas: LinhaPlanilha[]): ConversaoVariaveis {
  const mapa = mapearCabecalhos(cabecalhos);
  if (!mapa.nomeColaborador) {
    throw new Error('Não foi possível identificar a coluna do colaborador (ex.: "Nome do colaborador").');
  }

  const itens: LinhaImportacaoVariavel[] = [];
  const descartadas: ConversaoVariaveis["descartadas"] = [];

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
      transporte: mapa.transporte ? paraNumeroOuNulo(linha[mapa.transporte]) : null,
      mobilidade: mapa.mobilidade ? paraNumeroOuNulo(linha[mapa.mobilidade]) : null,
      alimentacao: mapa.alimentacao ? paraNumeroOuNulo(linha[mapa.alimentacao]) : null,
      motivo: mapa.motivo ? String(linha[mapa.motivo] ?? "").trim() || null : null,
    });
  });

  return { itens, descartadas };
}
