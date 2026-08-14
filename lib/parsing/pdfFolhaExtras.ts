import "server-only";
import type { LinhaPlanilha } from "./spreadsheet";

export interface TabelaPdfParseada {
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
}

const TERMOS_CABECALHO = ["colaborador", "nome", "vm", "odontologico", "solides", "flash", "bonificacao", "premiacao", "codigo"];

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

function dividirColunas(linha: string): string[] {
  return linha
    .split(/\s{2,}|\t/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * Extrai a tabela de verbas extras de um PDF por MELHOR ESFORÇO: localiza a
 * linha de cabeçalho (termos como "colaborador"/"vm"/"odontologico") e separa
 * colunas por 2+ espaços — mesma heurística usada para PDFs de férias.
 *
 * LIMITAÇÃO: extração de texto de PDF não preserva alinhamento de colunas de
 * forma confiável — prefira XLSX/CSV quando possível e revise o resultado.
 */
export async function parsearFolhaExtrasPdf(buffer: ArrayBuffer): Promise<TabelaPdfParseada> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  let texto: string;
  try {
    const resultado = await parser.getText();
    texto = resultado.text ?? "";
  } finally {
    await parser.destroy();
  }

  if (texto.trim().length < 20) {
    throw new Error(
      "Este PDF não tem camada de texto (parece ser digitalizado/imagem) — não é possível ler os dados automaticamente. Exporte em XLSX.",
    );
  }

  const linhasTexto = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const indiceCabecalho = linhasTexto.findIndex((l) => {
    const n = normalizar(l);
    return TERMOS_CABECALHO.filter((t) => n.includes(t)).length >= 2;
  });
  if (indiceCabecalho === -1) {
    throw new Error(
      'Não foi possível localizar a linha de cabeçalho no PDF (esperado algo como "Colaborador VM Odontológico..."). Exporte em XLSX para um resultado confiável.',
    );
  }

  const cabecalhos = dividirColunas(linhasTexto[indiceCabecalho]);
  const linhas: LinhaPlanilha[] = [];
  for (let i = indiceCabecalho + 1; i < linhasTexto.length; i++) {
    const campos = dividirColunas(linhasTexto[i]);
    if (campos.length < 2) continue;
    const registro: LinhaPlanilha = {};
    cabecalhos.forEach((c, idx) => {
      registro[c] = campos[idx] ?? null;
    });
    linhas.push(registro);
  }

  return { cabecalhos, linhas };
}
