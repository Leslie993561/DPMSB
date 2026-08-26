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

/** Rótulos de uma linha, sem vazios e normalizados para comparação. */
function rotulosDaLinha(sheet: ExcelJS.Worksheet, numero: number): string[] {
  const rotulos: string[] = [];
  sheet.getRow(numero).eachCell({ includeEmpty: false }, (cell) => {
    const texto = String(normalizarCelula(cell.value) ?? "").trim();
    if (texto) rotulos.push(texto.toLowerCase());
  });
  return rotulos;
}

/**
 * Descobre em qual linha estão os nomes das colunas.
 *
 * A planilha-mestre do DP tem duas linhas de cabeçalho: a primeira agrupa
 * ("Dados Pessoais" repetido em onze colunas) e a segunda traz os nomes de
 * verdade ("Nome", "CPF", "PIS"...). Ler a primeira devolvia onze colunas com o
 * mesmo nome e o arquivo inteiro era rejeitado.
 *
 * A pista é a repetição: um cabeçalho de verdade tem rótulos distintos, uma
 * faixa de grupo repete o mesmo texto célula a célula. Quando a linha 1 tem
 * menos da metade de rótulos distintos, o cabeçalho é a linha 2.
 */
function acharLinhaDeCabecalho(sheet: ExcelJS.Worksheet): number {
  const primeira = rotulosDaLinha(sheet, 1);
  if (primeira.length < 3) return 1;

  const distintos = new Set(primeira).size;
  const ehFaixaDeGrupo = distintos * 2 <= primeira.length;
  if (!ehFaixaDeGrupo) return 1;

  // Só desce se a linha 2 realmente parecer cabeçalho: mais rótulos distintos.
  const segunda = rotulosDaLinha(sheet, 2);
  return new Set(segunda).size > distintos ? 2 : 1;
}

/**
 * Lê a primeira planilha de um arquivo .xlsx/.csv e devolve os cabeçalhos
 * e as linhas como objetos. O cabeçalho normalmente é a primeira linha, mas
 * uma faixa de grupo acima dele é detectada e pulada — ver
 * `acharLinhaDeCabecalho`. Não interpreta o significado das colunas: esse
 * mapeamento é feito em mappers.ts e confirmado pelo usuário.
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

  const numeroCabecalho = acharLinhaDeCabecalho(sheet);
  const linhaCabecalho = sheet.getRow(numeroCabecalho);
  const cabecalhos: string[] = [];
  linhaCabecalho.eachCell({ includeEmpty: false }, (cell, col) => {
    cabecalhos[col - 1] = String(normalizarCelula(cell.value) ?? `Coluna ${col}`).trim();
  });

  // Rótulo repetido ganha o nome do grupo na frente. Na planilha-mestre do DP a
  // coluna do cônjuge se chama só "Nome", igual à do colaborador — sem o grupo,
  // o casamento pegava a primeira e copiava o nome da própria pessoa para o
  // campo do cônjuge. Com o grupo vira "Cônjunge · Nome", que é inequívoco.
  if (numeroCabecalho > 1) {
    const vezes = new Map<string, number>();
    for (const rotulo of cabecalhos) {
      if (!rotulo) continue;
      const chave = rotulo.toLowerCase();
      vezes.set(chave, (vezes.get(chave) ?? 0) + 1);
    }
    const linhaGrupo = sheet.getRow(numeroCabecalho - 1);
    cabecalhos.forEach((rotulo, i) => {
      if (!rotulo || (vezes.get(rotulo.toLowerCase()) ?? 0) < 2) return;
      const grupo = String(normalizarCelula(linhaGrupo.getCell(i + 1).value) ?? "").trim();
      if (grupo) cabecalhos[i] = `${grupo} · ${rotulo}`;
    });
  }

  if (cabecalhos.filter(Boolean).length === 0) {
    throw new Error("A primeira linha da planilha deve conter os nomes das colunas.");
  }

  const linhas: LinhaPlanilha[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
    if (numeroLinha <= numeroCabecalho) return;
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
