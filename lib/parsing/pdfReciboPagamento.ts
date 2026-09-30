import "server-only";

export interface FuncionarioRecibo {
  /** Código do funcionário no sistema de folha (não é o id do portal). */
  codigo: string;
  nome: string;
  salarioBase: number;
}

export interface FuncionarioLiquido {
  codigo: string;
  nome: string;
  cpf: string;
}

/** "1.234,56" → 1234.56; "*********" (linha em branco/carry-forward) → null. */
function paraNumeroBR(texto: string | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.trim();
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function extrairTexto(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const resultado = await parser.getText();
    return resultado.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/**
 * Recibo de Pagamento (um holerite por página, cada um impresso em 2 vias
 * idênticas empilhadas) — extrai só Código, Nome e Salário Base de cada
 * funcionário.
 *
 * A extração de texto do PDF não preserva a ordem visual: os rótulos vêm
 * DEPOIS do valor a que se referem ("2.100,00\nSalário Base" = Salário Base é
 * 2.100,00). Por isso a leitura é: para cada ocorrência exata da linha
 * "Salário Base", o valor é a linha imediatamente anterior — mesmo padrão
 * para "Código" → o código é a linha anterior, o nome é a linha seguinte.
 *
 * Um funcionário cujo cálculo foi reprocessado em lote (ex.: ajuste de
 * férias no meio do mês) pode ter uma primeira via "em branco" (valores
 * substituídos por asteriscos, "A TRANSPORTAR") — essas ocorrências não têm
 * um número válido antes de "Salário Base" e são ignoradas; o valor final
 * vem da via que realmente fechou o cálculo.
 */
export async function parsearReciboPagamento(buffer: ArrayBuffer): Promise<FuncionarioRecibo[]> {
  const texto = await extrairTexto(buffer);
  if (texto.trim().length < 20) {
    throw new Error("Este PDF não tem camada de texto (parece ser digitalizado/imagem) — não é possível ler automaticamente.");
  }

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const porCodigo = new Map<string, FuncionarioRecibo>();
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i] !== "Código") continue;
    const codigo = linhas[i - 1];
    const nome = linhas[i + 1];
    if (!/^\d+$/.test(codigo ?? "") || !nome) continue;

    // Procura o próximo "Salário Base" a partir daqui, mas sem passar do
    // próximo "Código" (que já seria o holerite de outra pessoa).
    let salarioBase: number | null = null;
    for (let j = i + 1; j < linhas.length; j++) {
      if (linhas[j] === "Código") break;
      if (linhas[j] === "Salário Base") {
        salarioBase = paraNumeroBR(linhas[j - 1]);
        if (salarioBase !== null) break;
      }
    }

    // Primeira ocorrência com valor válido vence — uma pessoa reprocessada em
    // lote (ex.: ajuste de férias no meio do mês) tem uma via inicial "em
    // branco" antes da via que realmente fechou o cálculo; sem valor válido
    // em nenhuma via, a pessoa fica de fora (sinalizada como descartada por
    // quem chama, não silenciosamente como 0).
    if (salarioBase !== null && !porCodigo.has(codigo)) {
      porCodigo.set(codigo, { codigo, nome, salarioBase });
    }
  }

  return [...porCodigo.values()];
}

const LINHA_LIQUIDO =
  /^(\d{3}\.\d{3}\.\d{3}-\d{2})\t(\d+)\s+(.+?)\s+\d{2}\/\d{2}\/\d{4}\t([\d.,]+)$/;

/**
 * Relação Geral dos Líquidos — só serve pra dar o CPF de cada Código (o
 * Recibo de Pagamento não imprime CPF). Formato tabular, uma linha por
 * funcionário: "{cpf}\t{codigo} {NOME} {data}\t{valor}".
 */
export async function parsearRelatorioLiquidos(buffer: ArrayBuffer): Promise<FuncionarioLiquido[]> {
  const texto = await extrairTexto(buffer);
  if (texto.trim().length < 20) {
    throw new Error("Este PDF não tem camada de texto (parece ser digitalizado/imagem) — não é possível ler automaticamente.");
  }

  const resultado: FuncionarioLiquido[] = [];
  for (const linhaBruta of texto.split("\n")) {
    const linha = linhaBruta.replace(/\r$/, "");
    const match = LINHA_LIQUIDO.exec(linha);
    if (!match) continue;
    const [, cpf, codigo, nome] = match;
    resultado.push({ codigo, nome: nome.trim(), cpf });
  }
  return resultado;
}
