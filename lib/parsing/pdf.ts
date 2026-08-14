import "server-only";

/** Campos que tentamos reconhecer heuristicamente em um holerite. */
export type CampoHolerite =
  | "salarioBase"
  | "inss"
  | "irrf"
  | "fgts"
  | "liquido";

export interface CampoDetectado {
  campo: CampoHolerite;
  /** Valor numérico detectado, ou null se não encontrado. */
  valor: number | null;
  /** Trecho do texto onde o valor foi encontrado, para o usuário conferir. */
  contexto: string | null;
}

export interface HoleritePdfParseado {
  textoBruto: string;
  camposDetectados: CampoDetectado[];
  /**
   * true quando o PDF não tem camada de texto (provavelmente digitalizado).
   * Nesse caso nenhum campo pode ser extraído sem OCR, que está fora do escopo.
   */
  semCamadaDeTexto: boolean;
  paginas: number;
}

const ROTULOS: Record<CampoHolerite, RegExp[]> = {
  salarioBase: [/sal[áa]rio\s*base/i, /sal[áa]rio\s*bruto/i, /vencimento/i],
  inss: [/inss/i, /previd[êe]ncia/i],
  irrf: [/irrf/i, /i\.?r\.?r\.?f/i, /imposto\s*de\s*renda/i],
  fgts: [/fgts/i],
  liquido: [/l[íi]quido/i, /valor\s*a\s*receber/i],
};

/** Captura um número no formato brasileiro (1.234,56) ou simples (1234.56). */
const NUMERO = /(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/;

function parseNumeroBR(texto: string): number | null {
  const limpo = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai texto de um holerite em PDF e tenta reconhecer valores por rótulo.
 *
 * LIMITAÇÕES IMPORTANTES (devem ser comunicadas ao usuário na interface):
 * - Só funciona em PDFs com camada de texto. PDFs digitalizados (imagem) não
 *   são suportados — OCR está fora do escopo desta fase.
 * - Mesmo em PDFs de texto, o reconhecimento por rótulo é heurístico: layouts
 *   de holerite variam muito entre sistemas de folha (Totvs, Senior, SAP,
 *   planilhas internas). Os valores retornados são um PALPITE e precisam ser
 *   confirmados pelo usuário antes de alimentarem qualquer cálculo.
 */
export async function parsearHoleritePdf(buffer: ArrayBuffer): Promise<HoleritePdfParseado> {
  const { PDFParse } = await import("pdf-parse");

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const resultado = await parser.getText();
    const textoBruto = resultado.text ?? "";
    const semCamadaDeTexto = textoBruto.trim().length < 20;

    const camposDetectados: CampoDetectado[] = (
      Object.keys(ROTULOS) as CampoHolerite[]
    ).map((campo) => {
      if (semCamadaDeTexto) return { campo, valor: null, contexto: null };

      for (const rotulo of ROTULOS[campo]) {
        // Procura o rótulo seguido de um número na mesma linha.
        const linha = textoBruto
          .split("\n")
          .find((l) => rotulo.test(l) && NUMERO.test(l));
        if (!linha) continue;

        const posRotulo = linha.search(rotulo);
        const depoisDoRotulo = linha.slice(posRotulo);
        const match = depoisDoRotulo.match(NUMERO);
        if (match) {
          return { campo, valor: parseNumeroBR(match[1]), contexto: linha.trim() };
        }
      }
      return { campo, valor: null, contexto: null };
    });

    return {
      textoBruto,
      camposDetectados,
      semCamadaDeTexto,
      paginas: resultado.total ?? 0,
    };
  } finally {
    await parser.destroy();
  }
}
