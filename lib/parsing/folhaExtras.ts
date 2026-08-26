import "server-only";
import type { LinhaPlanilha } from "./spreadsheet";
import { parsearHoras, horasImplausiveis, formatarHoras } from "@/lib/folha/horas";

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

export interface LinhaExtrasImportada {
  codigo: string | null;
  nomeColaborador: string;
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  premiacao: number | null;
  /**
   * HORAS, não reais. O DP lança "08:01" e aqui chega 8,0167 — o valor é
   * calculado depois, pelo salário do colaborador.
   */
  horaExtra50: number | null;
  horaExtra100: number | null;
  /** Horas descontadas: entra positivo na planilha e SUBTRAI do custo. */
  descontoHoras: number | null;
  horaNoturna: number | null;
  outrosCustos: number | null;
}

type CampoExtra =
  | "codigo"
  | "nomeColaborador"
  | "vm"
  | "odontologico"
  | "solides"
  | "flash"
  | "bonificacao"
  | "premiacao"
  | "horaExtra50"
  | "horaExtra100"
  | "descontoHoras"
  | "horaNoturna";

const SINONIMOS: Record<CampoExtra, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeColaborador: ["nome do colaborador", "colaborador", "nome", "empregado", "funcionario"],
  vm: ["vm", "vale mercado", "vale refeicao"],
  odontologico: ["odontologico", "odonto", "plano odontologico"],
  solides: ["solides"],
  flash: ["flash"],
  bonificacao: ["bonificacao", "bonificacao fixa"],
  premiacao: ["premiacao", "premiacao do mes", "premio"],
  // Os sinônimos de 100% vêm antes na busca por casarem com o texto mais
  // específico; "hora extra" sozinho ficaria ambíguo entre os dois percentuais.
  // "H.E. 100%" normaliza para "h e 100" — abreviação com ponto é comum no
  // arquivo do DP e antes caía silenciosamente em "Outros custos".
  horaExtra100: [
    "hora extra 100",
    "horas extras 100",
    "he 100",
    "he100",
    "h e 100",
    "hora extra 100%",
    "extra 100",
    "he 100%",
    "adicional 100",
  ],
  horaExtra50: [
    "hora extra 50",
    "horas extras 50",
    "he 50",
    "he50",
    "hora extra 50%",
    "extra 50",
    "he 50%",
    "h e 50",
    "adicional 50",
    "hora extra",
    "horas extras",
  ],
  descontoHoras: [
    "desconto de horas",
    "desconto horas",
    "horas descontadas",
    "desc horas",
    "faltas horas",
    "desconto de hora",
    "desc de horas",
    "horas desconto",
  ],
  horaNoturna: ["hora noturna", "horas noturnas", "adicional noturno", "ad noturno", "adic noturno", "noturno"],
};

/** Nome que a tela mostra quando a coluna não é encontrada no arquivo. */
const ROTULO_CAMPO: Record<CampoExtra, string> = {
  codigo: "Código",
  nomeColaborador: "Nome do colaborador",
  vm: "VM",
  odontologico: "Odontológico",
  solides: "Sólides",
  flash: "Flash",
  bonificacao: "Bonificação",
  premiacao: "Premiação",
  horaExtra50: "Hora extra 50% (horas)",
  horaExtra100: "Hora extra 100% (horas)",
  descontoHoras: "Desconto de horas (horas)",
  horaNoturna: "Hora noturna (horas)",
};

// Colunas que fazem parte do núcleo calculado (nunca vêm de planilha importada) — ignoradas ao
// decidir o que vira "outros custos", para não somar salário/INSS/FGTS/VT/VA como custo extra.
const SINONIMOS_NUCLEO = [
  "salario",
  "salario base",
  "inss",
  "irrf",
  "fgts",
  "provisao",
  "provisao 13",
  "total de encargos",
  "total encargos",
  "vt",
  "vale transporte",
  "va",
  "vale alimentacao",
  "custo total",
  "total do colaborador",
  // Calculadas pelo cadastro/motor: aparecem no modelo para o arquivo ter a
  // mesma cara do relatório, mas não podem virar "outros custos" se vierem
  // preenchidas — seria somar duas vezes o mesmo dinheiro.
  "salario familia",
  "periculosidade",
  "insalubridade",
  "adicional fixo",
  "cargo",
  "departamento",
  "setor",
  "vinculo",
];

function mapearCabecalhos(cabecalhos: string[]): { mapa: Partial<Record<CampoExtra, string>>; naoReconhecidas: string[] } {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  // Comparação por palavra inteira (não substring solta) — "va" não pode casar dentro de "vale cultura".
  const bate = (norm: string, sinonimo: string) => norm === sinonimo || new RegExp(`\\b${sinonimo}\\b`).test(norm);

  const mapa: Partial<Record<CampoExtra, string>> = {};
  (Object.keys(SINONIMOS) as CampoExtra[]).forEach((campo) => {
    const encontrado = normalizados.find((c) => SINONIMOS[campo].some((s) => bate(c.norm, s)));
    if (encontrado) mapa[campo] = encontrado.original;
  });

  const usadas = new Set(Object.values(mapa));
  const naoReconhecidas = normalizados
    .filter((c) => !usadas.has(c.original) && !SINONIMOS_NUCLEO.some((s) => bate(c.norm, s)))
    .map((c) => c.original);

  return { mapa, naoReconhecidas };
}

function paraNumeroOuNulo(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface ConversaoExtras {
  itens: LinhaExtrasImportada[];
  colunasReconhecidas: string[];
  colunasOutros: string[];
  /**
   * Verbas que o portal sabe ler mas que NÃO existiam no arquivo. Sem esta
   * lista a importação parecia ter dado certo quando metade das colunas ficava
   * de fora — foi assim que um mês inteiro entrou sem as horas extras, e nada
   * na tela dizia o porquê.
   */
  colunasNaoEncontradas: string[];
  /**
   * Verbas que existiam como coluna no arquivo. Só elas são gravadas — as
   * ausentes ficam como estavam, senão importar uma planilha com metade das
   * colunas apagaria a outra metade.
   */
  camposPresentes: CampoExtra[];
  /**
   * Horas que não cabem num mês de trabalho. Não são recusadas — quem lança é
   * que sabe —, mas precisam aparecer: uma célula com valor em reais no lugar
   * da hora vira centenas de horas e some dentro do total sem ninguém notar.
   */
  horasSuspeitas: { linha: number; colaborador: string; coluna: string; valor: string; motivo: string }[];
  descartadas: { linha: number; motivo: string }[];
}

export type { CampoExtra };

/**
 * Identifica cada verba pelo cabeçalho da coluna (não pela posição) — colunas
 * que não correspondem a nenhuma verba conhecida (nem ao núcleo calculado:
 * salário, INSS, FGTS, VT, VA etc., que nunca vêm de planilha) somam juntas
 * como "Outros custos" da linha, nunca são descartadas.
 */
export function converterExtrasImportadas(cabecalhos: string[], linhas: LinhaPlanilha[]): ConversaoExtras {
  const { mapa, naoReconhecidas } = mapearCabecalhos(cabecalhos);
  if (!mapa.nomeColaborador) {
    throw new Error('Não foi possível identificar a coluna do colaborador (ex.: "Nome do colaborador").');
  }

  const itens: LinhaExtrasImportada[] = [];
  const descartadas: ConversaoExtras["descartadas"] = [];
  const horasSuspeitas: ConversaoExtras["horasSuspeitas"] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const nomeColaborador = String(linha[mapa.nomeColaborador!] ?? "").trim();
    if (!nomeColaborador) {
      descartadas.push({ linha: numeroLinha, motivo: "Nome do colaborador ausente." });
      return;
    }

    /** Lê a hora da coluna e registra a suspeita quando o número não cabe num mês. */
    function conferirHoras(coluna: string | undefined, rotulo: string): number | null {
      if (!coluna) return null;
      const bruto = linha[coluna];
      const horas = parsearHoras(bruto);

      // Célula com conteúdo que o portal não conseguiu ler como hora. É o caso
      // mais perigoso: some sem deixar rastro e o mês fica sem a verba.
      const temConteudo = bruto !== null && bruto !== undefined && String(bruto).trim() !== "";
      if (temConteudo && horas === null) {
        horasSuspeitas.push({
          linha: numeroLinha,
          colaborador: nomeColaborador,
          coluna: rotulo,
          valor: String(bruto),
          motivo: "não foi lido como hora — use o formato hh:mm (ex.: 08:01)",
        });
        return null;
      }

      if (horasImplausiveis(horas)) {
        horasSuspeitas.push({
          linha: numeroLinha,
          colaborador: nomeColaborador,
          coluna: rotulo,
          valor: formatarHoras(horas),
          motivo: "não cabe num mês de trabalho — confira se a célula não tem valor em reais",
        });
      }
      return horas;
    }

    const outrosCustosSoma = naoReconhecidas.reduce((soma, coluna) => {
      const valor = paraNumeroOuNulo(linha[coluna]);
      return soma + (valor ?? 0);
    }, 0);
    const temOutros = naoReconhecidas.some((coluna) => paraNumeroOuNulo(linha[coluna]) !== null);

    itens.push({
      codigo: mapa.codigo ? String(linha[mapa.codigo] ?? "").trim() || null : null,
      nomeColaborador,
      vm: mapa.vm ? paraNumeroOuNulo(linha[mapa.vm]) : null,
      odontologico: mapa.odontologico ? paraNumeroOuNulo(linha[mapa.odontologico]) : null,
      solides: mapa.solides ? paraNumeroOuNulo(linha[mapa.solides]) : null,
      flash: mapa.flash ? paraNumeroOuNulo(linha[mapa.flash]) : null,
      bonificacao: mapa.bonificacao ? paraNumeroOuNulo(linha[mapa.bonificacao]) : null,
      premiacao: mapa.premiacao ? paraNumeroOuNulo(linha[mapa.premiacao]) : null,
      // Estas quatro passam por parsearHoras, não por paraNumeroOuNulo:
      // "08:01" são oito horas e um minuto, e não o número 8,01.
      horaExtra50: conferirHoras(mapa.horaExtra50, "Hora extra 50%"),
      horaExtra100: conferirHoras(mapa.horaExtra100, "Hora extra 100%"),
      descontoHoras: conferirHoras(mapa.descontoHoras, "Desconto de horas"),
      horaNoturna: conferirHoras(mapa.horaNoturna, "Hora noturna"),
      outrosCustos: temOutros ? outrosCustosSoma : null,
    });
  });

  const naoEncontradas = (Object.keys(SINONIMOS) as CampoExtra[])
    .filter((campo) => campo !== "codigo" && campo !== "nomeColaborador" && !mapa[campo])
    .map((campo) => ROTULO_CAMPO[campo]);

  return {
    itens,
    colunasReconhecidas: Object.values(mapa) as string[],
    colunasOutros: naoReconhecidas,
    colunasNaoEncontradas: naoEncontradas,
    horasSuspeitas,
    camposPresentes: (Object.keys(mapa) as CampoExtra[]).filter(
      (campo) => campo !== "codigo" && campo !== "nomeColaborador",
    ),
    descartadas,
  };
}
