import "server-only";

/**
 * Carrega o pdf-parse garantindo as APIs de DOM que o PDF.js exige (DOMMatrix,
 * ImageData, Path2D). No Node o pdf-parse as injeta sozinho a partir do
 * @napi-rs/canvas, mas quando o Next resolve o pacote como externo o
 * polyfill pode não rodar e estoura "DOMMatrix is not defined". Definir aqui,
 * antes do import, evita depender de como o bundler resolveu o pacote.
 */
export async function carregarPdfParse() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined" || typeof g.ImageData === "undefined" || typeof g.Path2D === "undefined") {
    const canvas = await import("@napi-rs/canvas");
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.ImageData ??= canvas.ImageData;
    g.Path2D ??= canvas.Path2D;
  }
  return import("pdf-parse");
}
