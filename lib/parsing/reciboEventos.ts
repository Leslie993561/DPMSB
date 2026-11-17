/**
 * Leitura dos eventos (proventos/descontos) do Recibo de Pagamento a partir dos
 * itens de texto COM coordenadas. Vive separado do PDF.js para poder ser testado
 * com itens sintéticos.
 *
 * Por que coordenadas: a extração de texto "corrida" do PDF despeja a tabela de
 * eventos em blocos separados (todos os códigos, depois todas as descrições,
 * depois todas as referências...), sem como saber que "4,72" pertence a "HORAS
 * EXTRAS". Pela posição, cada linha da tabela volta a ser uma linha.
 */

export interface ItemTexto {
  x: number;
  y: number;
  texto: string;
}

export interface EventoRecibo {
  codigo: string;
  descricao: string;
  /** Coluna "Referência": horas (decimais), dias ou percentual, conforme o evento. */
  referencia: number | null;
  vencimento: number | null;
  desconto: number | null;
}

export interface HoleriteLido {
  codigo: string;
  nome: string;
  /** "2026-08", a partir de "Agosto de 2026" impresso no recibo. */
  competencia: string | null;
  /** null quando a via está "em branco" (asteriscos de lote reprocessado). */
  salarioBase: number | null;
  eventos: EventoRecibo[];
}

/** "1.234,56" → 1234.56; "*********" (via em branco) → null. */
export function paraNumeroBR(texto: string | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.trim();
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "");
}

/** "Agosto de 2026" → "2026-08"; qualquer outra coisa → null. */
export function competenciaDeTexto(texto: string): string | null {
  const m = /^(\p{L}+)\s+de\s+(\d{4})$/u.exec(texto.trim());
  if (!m) return null;
  const mes = MESES.indexOf(semAcento(m[1]).toLowerCase());
  return mes === -1 ? null : `${m[2]}-${String(mes + 1).padStart(2, "0")}`;
}

// A página traz o holerite em 2 vias empilhadas; o cabeçalho de cada via começa
// 10pt acima do "Folha Mensal".
const FOLGA_TOPO_VIA = 15;
// Coluna do código do evento (à esquerda da descrição).
const CODIGO_ATE_X = 34;
// Linhas da mesma linha visual podem diferir 1pt de y entre colunas.
const TOLERANCIA_LINHA = 3;

function agruparLinhas(itens: ItemTexto[]): ItemTexto[][] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: ItemTexto[][] = [];
  for (const item of ordenados) {
    const atual = linhas[linhas.length - 1];
    if (atual && Math.abs(atual[0].y - item.y) <= TOLERANCIA_LINHA) atual.push(item);
    else linhas.push([item]);
  }
  return linhas;
}

function lerVia(via: ItemTexto[]): HoleriteLido | null {
  const achar = (texto: string) => via.find((i) => i.texto === texto);

  const cabNome = achar("Nome do Funcionário");
  const cabCbo = achar("CBO");
  if (!cabNome) return null;

  const linhaPessoa = via.filter((i) => i.y < cabNome.y - 4 && i.y > cabNome.y - 16);
  const codigo = linhaPessoa.find((i) => i.x < CODIGO_ATE_X && /^\d+$/.test(i.texto))?.texto;
  // O CBO (só dígitos) começa um pouco à esquerda do próprio rótulo.
  const limiteNome = (cabCbo?.x ?? 400) - 15;
  const nome = linhaPessoa
    .filter((i) => i.x >= CODIGO_ATE_X && i.x < limiteNome && !/^\d+$/.test(i.texto))
    .sort((a, b) => a.x - b.x)
    .map((i) => i.texto)
    .join(" ")
    .trim();
  if (!codigo || !nome) return null;

  const competencia = via.map((i) => competenciaDeTexto(i.texto)).find((c) => c !== null) ?? null;

  // O valor do Salário Base está logo abaixo do rótulo, alinhado à direita —
  // pega o item da linha de baixo mais próximo da posição do rótulo.
  let salarioBase: number | null = null;
  const cabSalario = achar("Salário Base");
  if (cabSalario) {
    const candidatos = via
      .filter((i) => i.y < cabSalario.y - 4 && i.y > cabSalario.y - 16)
      .sort((a, b) => Math.abs(a.x - cabSalario.x) - Math.abs(b.x - cabSalario.x));
    salarioBase = paraNumeroBR(candidatos[0]?.texto);
  }

  const eventos: EventoRecibo[] = [];
  const cabDescricao = achar("Descrição");
  const cabReferencia = achar("Referência");
  const cabVencimentos = achar("Vencimentos");
  const cabDescontos = achar("Descontos");
  const totais = achar("Total de Vencimentos");
  if (cabDescricao && cabReferencia && cabVencimentos && cabDescontos) {
    const fimDescricao = cabReferencia.x + 15;
    const iniVenc = cabVencimentos.x - 3;
    const iniDesc = cabDescontos.x - 3;
    const area = via.filter(
      (i) => i.y < cabDescricao.y - TOLERANCIA_LINHA && (!totais || i.y > totais.y + TOLERANCIA_LINHA),
    );

    for (const linha of agruparLinhas(area)) {
      const cod = linha.find((i) => i.x < CODIGO_ATE_X && /^\d+$/.test(i.texto))?.texto;
      const descricao = linha
        .filter((i) => i.x >= CODIGO_ATE_X && i.x < fimDescricao)
        .sort((a, b) => a.x - b.x)
        .map((i) => i.texto)
        .join(" ")
        .trim();
      if (!cod || !descricao) continue;

      // Só itens numéricos entram nas colunas de valor — textos soltos do
      // rodapé (assinatura, mensagens) que cruzem a linha são ignorados.
      const numero = (de: number, ate: number) =>
        paraNumeroBR(linha.find((i) => i.x >= de && i.x < ate && paraNumeroBR(i.texto) !== null)?.texto);
      eventos.push({
        codigo: cod,
        descricao,
        referencia: numero(fimDescricao, iniVenc),
        vencimento: numero(iniVenc, iniDesc),
        desconto: numero(iniDesc, Number.POSITIVE_INFINITY),
      });
    }
  }

  return { codigo, nome, competencia, salarioBase, eventos };
}

/** Todos os holerites (uma entrada por via) dos itens de UMA página. */
export function extrairHolerites(itens: ItemTexto[]): HoleriteLido[] {
  const topos = itens
    .filter((i) => /^Folha\s/.test(i.texto))
    .map((i) => i.y + FOLGA_TOPO_VIA)
    .sort((a, b) => b - a);

  const resultado: HoleriteLido[] = [];
  topos.forEach((topo, k) => {
    const base = topos[k + 1] ?? Number.NEGATIVE_INFINITY;
    const via = lerVia(itens.filter((i) => i.y <= topo && i.y > base));
    if (via) resultado.push(via);
  });
  return resultado;
}

export interface ProventosDoRecibo {
  /** Horas decimais somadas dos eventos de hora extra a 50%. */
  horasExtras50: number;
  horasExtras100: number;
  /** Valores em reais dos adicionais — null quando o recibo não traz o evento. */
  periculosidade: number | null;
  insalubridade: number | null;
}

function normalizarDescricao(texto: string): string {
  return semAcento(texto).toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Separa, entre os eventos de um holerite, os que o portal sabe usar. O
 * "REFLEXO ... DSR" fica de fora de propósito: o DSR das horas é calculado pelo
 * próprio portal a partir das horas, importá-lo contaria duas vezes.
 */
export function resumirProventos(eventos: EventoRecibo[]): ProventosDoRecibo {
  const resumo: ProventosDoRecibo = {
    horasExtras50: 0,
    horasExtras100: 0,
    periculosidade: null,
    insalubridade: null,
  };

  for (const evento of eventos) {
    const d = normalizarDescricao(evento.descricao);
    if (d.startsWith("REFLEXO") || evento.vencimento === null) continue;

    if (/^HORAS? EXTRAS?\b/.test(d)) {
      const horas = evento.referencia ?? 0;
      if (/100\s*%?|DOMINGO|FERIADO/.test(d)) resumo.horasExtras100 += horas;
      else resumo.horasExtras50 += horas;
    } else if (d.includes("PERICULOSIDADE")) {
      resumo.periculosidade = (resumo.periculosidade ?? 0) + evento.vencimento;
    } else if (d.includes("INSALUBRIDADE")) {
      resumo.insalubridade = (resumo.insalubridade ?? 0) + evento.vencimento;
    }
  }

  return resumo;
}

/**
 * Converte o valor em reais do recibo no percentual do cadastro, mas só quando
 * ele bate com um percentual legal (periculosidade 30; insalubridade 10/20/40).
 * Num mês com férias ou afastamento o adicional vem proporcional e a conta daria
 * algo como 21,3% — gravar isso corromperia o cadastro. Nesse caso devolve null
 * e quem chama avisa para conferir.
 */
export function percentualPadrao(valor: number, base: number, padroes: number[], tolerancia = 0.5): number | null {
  if (base <= 0) return null;
  const percentual = (valor / base) * 100;
  return padroes.find((p) => Math.abs(percentual - p) <= tolerancia) ?? null;
}

export const PERCENTUAIS_PERICULOSIDADE = [30];
export const PERCENTUAIS_INSALUBRIDADE = [10, 20, 40];
