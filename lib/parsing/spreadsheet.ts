import "server-only";
import ExcelJS from "exceljs";

export type CelulaValor = string | number | null;
export type LinhaPlanilha = Record<string, CelulaValor>;

export interface PlanilhaParseada {
  cabecalhos: string[];
  linhas: LinhaPlanilha[];
}

function normalizarCelula(valor: ExcelJS.CellValue): CelulaValor {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" || typeof valor === "string") return valor;
  if (valor instanceof Date) {
    // Célula formatada como HORA no Excel chega como data ancorada em
    // 30/12/1899 (a época que o Excel usa para valores só de tempo). Cortar em
    // 10 caracteres jogava a hora fora e "04:17" virava "1899-12-30", que não
    // vira número nenhum — foi assim que uma planilha inteira de horas extras
    // entrou vazia. Aqui a hora é preservada como "HH:MM".
    // Só a época do Excel (30/12/1899) é hora-do-dia. Uma célula com formato de
    // hora mas conteúdo maior que 24h vira data de 1900 em diante, e aí o valor
    // NÃO é uma hora: é um número que foi digitado em cima de um formato de
    // hora. Devolver a data crua faz o parser de horas recusar, e a importação
    // avisa — melhor do que gravar 219 horas de desconto.
    const ehHoraDoExcel = valor.getUTCFullYear() === 1899;
    if (ehHoraDoExcel) {
      const hh = String(valor.getUTCHours()).padStart(2, "0");
      const mm = String(valor.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "object") {
    if ("result" in valor && valor.result !== undefined) {
      return normalizarCelula(valor.result as ExcelJS.CellValue);
    }
    if ("text" in valor && typeof valor.text === "string") return valor.text;
  }
  return String(valor);
}

/**
 * Lê a primeira planilha de um arquivo .xlsx/.csv e devolve os cabeçalhos
 * (primeira linha) e as linhas como objetos. Não interpreta o significado das
 * colunas — esse mapeamento é feito em mappers.ts e confirmado pelo usuário.
 */
export async function parsearPlanilha(
  buffer: ArrayBuffer,
  nomeArquivo: string,
): Promise<PlanilhaParseada> {
  const workbook = new ExcelJS.Workbook();

  if (nomeArquivo.toLowerCase().endsWith(".csv")) {
    const texto = new TextDecoder("utf-8").decode(buffer);
    const { Readable } = await import("node:stream");
    await workbook.csv.read(Readable.from([texto]));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("O arquivo não contém nenhuma planilha legível.");
  }

  const linhaCabecalho = sheet.getRow(1);
  const cabecalhos: string[] = [];
  linhaCabecalho.eachCell({ includeEmpty: false }, (cell, col) => {
    cabecalhos[col - 1] = String(normalizarCelula(cell.value) ?? `Coluna ${col}`).trim();
  });

  if (cabecalhos.filter(Boolean).length === 0) {
    throw new Error("A primeira linha da planilha deve conter os nomes das colunas.");
  }

  const linhas: LinhaPlanilha[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
    if (numeroLinha === 1) return;
    const registro: LinhaPlanilha = {};
    let temConteudo = false;
    cabecalhos.forEach((cabecalho, i) => {
      if (!cabecalho) return;
      const valor = normalizarCelula(row.getCell(i + 1).value);
      registro[cabecalho] = valor;
      if (valor !== null && valor !== "") temConteudo = true;
    });
    if (temConteudo) linhas.push(registro);
  });

  return { cabecalhos: cabecalhos.filter(Boolean), linhas };
}
