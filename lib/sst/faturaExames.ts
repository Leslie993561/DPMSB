/**
 * Leitura da fatura mensal da clínica de SST (Inovaprev): um bloco por ASO
 * ("ASO Admissional  NOME (CPF) em dd/mm/aaaa", valor do ASO) seguido das linhas
 * de cada exame "(código) NOME  R$ valor". Função pura — recebe o texto já extraído do PDF.
 */
export interface ExameFatura {
  codigo: string;
  nome: string;
  valor: number;
}

export interface AsoFatura {
  tipo: string;
  colaborador: string;
  cpf: string;
  /** dd/mm/aaaa */
  data: string;
  valor: number;
  exames: ExameFatura[];
}

export interface FaturaExames {
  /** dd/mm/aaaa */
  fechamento: string;
  total: number;
  asos: AsoFatura[];
}

function moeda(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

const RE_FECHAMENTO = /Fechamento:\s*(\d{2}\/\d{2}\/\d{4})/;
const RE_ASO = /^(ASO\s+[^\t(]+?)\s*\t\s*(.+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)\s+em\s+(\d{2}\/\d{2}\/\d{4})/;
const RE_EXAME = /\((\d{3,5})\)\s+(.+?)\s*\t\s*R\$\s*([\d.]+,\d{2})/;
const RE_VALOR_ASO = /^R\$\s*([\d.]+,\d{2})/;
const RE_TOTAL = /R\$\s*([\d.]+,\d{2})\s*Total:/;

export function interpretarFaturaExames(texto: string): FaturaExames {
  const fechamento = RE_FECHAMENTO.exec(texto)?.[1];
  if (!fechamento) throw new Error("Não encontrei a data de fechamento — este PDF não parece uma fatura de exames.");

  const asos: AsoFatura[] = [];
  let atual: AsoFatura | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    const aso = RE_ASO.exec(linha);
    if (aso) {
      atual = { tipo: aso[1].replace(/\s+/g, " ").trim(), colaborador: aso[2].trim(), cpf: aso[3], data: aso[4], valor: 0, exames: [] };
      asos.push(atual);
      continue;
    }
    if (!atual) continue;
    if (linha.includes("Total:")) continue;
    const valorAso = RE_VALOR_ASO.exec(linha);
    if (valorAso) atual.valor = moeda(valorAso[1]);
    // O valor do ASO pode vir na mesma linha do primeiro exame — por isso não é `else`.
    const exame = RE_EXAME.exec(linha);
    if (exame) atual.exames.push({ codigo: exame[1], nome: exame[2].trim(), valor: moeda(exame[3]) });
  }

  if (asos.length === 0) throw new Error("Nenhum ASO encontrado na fatura.");

  // Sem valor explícito no bloco, o ASO vale a soma dos exames.
  for (const a of asos) if (!a.valor) a.valor = Math.round(a.exames.reduce((s, e) => s + e.valor, 0) * 100) / 100;

  const totalLido = RE_TOTAL.exec(texto)?.[1];
  const total = totalLido ? moeda(totalLido) : Math.round(asos.reduce((s, a) => s + a.valor, 0) * 100) / 100;
  return { fechamento, total, asos };
}
