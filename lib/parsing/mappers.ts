import type { LinhaPlanilha } from "./spreadsheet";

export interface SugestaoColuna<TCampo extends string = string> {
  campo: TCampo;
  /** Nome da coluna sugerida na planilha, ou null se nada foi reconhecido. */
  coluna: string | null;
  /** 0 a 1 — quanto maior, mais confiável o palpite. */
  confianca: number;
  obrigatorio: boolean;
}

/** Marcas de acentuação combinantes (Unicode Combining Diacritical Marks). */
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

/**
 * Motor genérico de sugestão de mapeamento por similaridade de nome. É apenas
 * um PALPITE — a UI precisa exibir estas sugestões para o usuário confirmar
 * ou corrigir antes de qualquer cálculo/importação, já que layouts de
 * planilha variam muito entre empresas e sistemas.
 */
function sugerirMapeamentoGenerico<TCampo extends string>(
  cabecalhos: string[],
  sinonimos: Record<TCampo, string[]>,
  obrigatorios: Record<TCampo, boolean>,
): SugestaoColuna<TCampo>[] {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));

  return (Object.keys(sinonimos) as TCampo[]).map((campo) => {
    const listaSinonimos = sinonimos[campo];

    const exato = normalizados.find((c) => listaSinonimos.includes(c.norm));
    if (exato) {
      return { campo, coluna: exato.original, confianca: 1, obrigatorio: obrigatorios[campo] };
    }

    const parcial = normalizados.find((c) =>
      listaSinonimos.some((s) => c.norm.includes(s) || s.includes(c.norm)),
    );
    if (parcial) {
      return { campo, coluna: parcial.original, confianca: 0.6, obrigatorio: obrigatorios[campo] };
    }

    return { campo, coluna: null, confianca: 0, obrigatorio: obrigatorios[campo] };
  });
}

// ---------------------------------------------------------------------------
// Folha de pagamento
// ---------------------------------------------------------------------------

export type CampoFolha = "nome" | "salarioBase" | "dependentes";

const SINONIMOS_FOLHA: Record<CampoFolha, string[]> = {
  nome: ["nome", "colaborador", "funcionario", "empregado", "nome do colaborador", "nome completo"],
  salarioBase: [
    "salario",
    "salario base",
    "salario-base",
    "sal base",
    "vencimento",
    "remuneracao",
    "salario bruto",
  ],
  dependentes: ["dependentes", "dependente", "qtd dependentes", "numero de dependentes", "deps"],
};

const OBRIGATORIOS_FOLHA: Record<CampoFolha, boolean> = {
  nome: false,
  salarioBase: true,
  dependentes: false,
};

export function sugerirMapeamento(cabecalhos: string[]): SugestaoColuna<CampoFolha>[] {
  return sugerirMapeamentoGenerico(cabecalhos, SINONIMOS_FOLHA, OBRIGATORIOS_FOLHA);
}

export interface ColaboradorFolha {
  nome: string;
  salarioBase: number;
  dependentes: number;
}

export interface ConversaoFolha {
  colaboradores: ColaboradorFolha[];
  /** Linhas descartadas por dados inválidos, com o motivo. Nunca são silenciadas. */
  descartadas: { linha: number; motivo: string }[];
}

/**
 * Converte as linhas da planilha em entradas do motor de cálculo usando o
 * mapeamento JÁ CONFIRMADO pelo usuário. Linhas inválidas são reportadas em
 * `descartadas` em vez de silenciosamente ignoradas ou preenchidas com zero.
 */
export function converterParaColaboradores(
  linhas: LinhaPlanilha[],
  mapeamento: Partial<Record<CampoFolha, string | null>>,
): ConversaoFolha {
  const colunaSalario = mapeamento.salarioBase;
  if (!colunaSalario) {
    throw new Error("A coluna de salário base é obrigatória e não foi mapeada.");
  }

  const colaboradores: ColaboradorFolha[] = [];
  const descartadas: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2; // +1 pelo cabeçalho, +1 porque planilha começa em 1

    const bruto = linha[colunaSalario];
    const salarioBase = typeof bruto === "number" ? bruto : Number(String(bruto ?? "").replace(",", "."));

    if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Salário base inválido ou ausente (valor lido: "${bruto ?? ""}").`,
      });
      return;
    }

    const nome = mapeamento.nome ? String(linha[mapeamento.nome] ?? "").trim() : "";
    const depBruto = mapeamento.dependentes ? linha[mapeamento.dependentes] : 0;
    const dependentes = Number(depBruto ?? 0);

    colaboradores.push({
      nome: nome || `Linha ${numeroLinha}`,
      salarioBase,
      dependentes: Number.isFinite(dependentes) && dependentes > 0 ? Math.floor(dependentes) : 0,
    });
  });

  return { colaboradores, descartadas };
}

// ---------------------------------------------------------------------------
// Cadastro de colaboradores
// ---------------------------------------------------------------------------

export type CampoColaborador =
  | "nome"
  | "dataAdmissao"
  | "dataNascimento"
  | "salarioBase"
  | "dependentes"
  | "cpf"
  | "email"
  | "cargo"
  | "departamento"
  | "vinculo"
  | "liderDireto"
  | "alimentacaoValor"
  | "cbo"
  | "cidade"
  | "agencia"
  | "conta";

const SINONIMOS_COLABORADOR: Record<CampoColaborador, string[]> = {
  nome: ["nome", "colaborador", "funcionario", "empregado", "nome completo"],
  dataAdmissao: ["admissao", "data admissao", "data de admissao", "dt admissao"],
  dataNascimento: ["nascimento", "data nascimento", "data de nascimento", "dt nascimento"],
  salarioBase: ["salario", "salario base", "salario-base", "vencimento", "remuneracao"],
  dependentes: ["dependentes", "dependente", "qtd dependentes", "numero de dependentes", "deps"],
  cpf: ["cpf"],
  email: ["email", "e mail", "e-mail"],
  cargo: ["cargo", "cod cargo", "codigo cargo", "funcao"],
  departamento: ["departamento", "setor", "area"],
  vinculo: ["vinculo", "tipo de vinculo", "contrato"],
  liderDireto: ["lider direto", "lider", "gestor", "gestor responsavel"],
  alimentacaoValor: ["alimentacao", "vale alimentacao", "va"],
  cbo: ["cbo"],
  cidade: ["cidade", "municipio"],
  agencia: ["agencia"],
  conta: ["conta", "conta corrente"],
};

const OBRIGATORIOS_COLABORADOR: Record<CampoColaborador, boolean> = {
  nome: false,
  dataAdmissao: true,
  dataNascimento: false,
  salarioBase: true,
  dependentes: false,
  cpf: false,
  email: false,
  cargo: false,
  departamento: false,
  vinculo: false,
  liderDireto: false,
  alimentacaoValor: false,
  cbo: false,
  cidade: false,
  agencia: false,
  conta: false,
};

export function sugerirMapeamentoColaborador(cabecalhos: string[]): SugestaoColuna<CampoColaborador>[] {
  return sugerirMapeamentoGenerico(cabecalhos, SINONIMOS_COLABORADOR, OBRIGATORIOS_COLABORADOR);
}

export interface ColaboradorImportado {
  nome: string;
  dataAdmissao: string; // ISO
  dataNascimento: string | null; // ISO
  salarioBase: number;
  dependentes: number;
  cpf: string | null;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  /** Nome do líder direto conforme a planilha — resolvido para gestorId numa etapa posterior (após todos os colaboradores existirem). */
  liderDiretoNome: string | null;
  alimentacaoValor: number | null;
  cbo: string | null;
  cidade: string | null;
  agencia: string | null;
  conta: string | null;
}

export interface ConversaoColaboradores {
  colaboradores: ColaboradorImportado[];
  descartadas: { linha: number; motivo: string }[];
}

/**
 * Converte uma data em formato ISO (2025-09-15) ou brasileiro (15/09/2025,
 * 15-09-2025) para ISO. Retorna null se não conseguir interpretar — nunca
 * adivinha um valor.
 */
function parseDataAdmissao(valor: string | number | null): string | null {
  if (valor === null) return null;
  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const brasileiro = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (brasileiro) {
    const [, dia, mes, ano] = brasileiro;
    const d = Number(dia);
    const m = Number(mes);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${ano}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Converte as linhas da planilha em colaboradores prontos para inserir no
 * cadastro, usando o mapeamento JÁ CONFIRMADO pelo usuário. Linhas com nome,
 * data de admissão ou salário inválidos são reportadas, nunca silenciadas.
 */
export function converterParaColaboradoresCadastro(
  linhas: LinhaPlanilha[],
  mapeamento: Partial<Record<CampoColaborador, string | null>>,
): ConversaoColaboradores {
  const colunaSalario = mapeamento.salarioBase;
  const colunaAdmissao = mapeamento.dataAdmissao;
  if (!colunaSalario) throw new Error("A coluna de salário base é obrigatória e não foi mapeada.");
  if (!colunaAdmissao) throw new Error("A coluna de data de admissão é obrigatória e não foi mapeada.");

  const colaboradores: ColaboradorImportado[] = [];
  const descartadas: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;

    const salarioBruto = linha[colunaSalario];
    const salarioBase =
      typeof salarioBruto === "number" ? salarioBruto : Number(String(salarioBruto ?? "").replace(",", "."));
    if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Salário base inválido ou ausente (valor lido: "${salarioBruto ?? ""}").`,
      });
      return;
    }

    const admissaoBruta = linha[colunaAdmissao];
    const dataAdmissao = parseDataAdmissao(admissaoBruta);
    if (!dataAdmissao) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Data de admissão inválida ou ausente (valor lido: "${admissaoBruta ?? ""}"). Use AAAA-MM-DD ou DD/MM/AAAA.`,
      });
      return;
    }

    const nome = mapeamento.nome ? String(linha[mapeamento.nome] ?? "").trim() : "";
    const depBruto = mapeamento.dependentes ? linha[mapeamento.dependentes] : 0;
    const dependentes = Number(depBruto ?? 0);

    const opcional = (campo: CampoColaborador): string | null => {
      const coluna = mapeamento[campo];
      if (!coluna) return null;
      const v = linha[coluna];
      return v === null || v === "" ? null : String(v).trim();
    };

    const alimentacaoBruta = mapeamento.alimentacaoValor ? linha[mapeamento.alimentacaoValor] : null;
    const alimentacaoValor =
      alimentacaoBruta === null || alimentacaoBruta === ""
        ? null
        : Number(typeof alimentacaoBruta === "number" ? alimentacaoBruta : String(alimentacaoBruta).replace(",", "."));

    colaboradores.push({
      nome: nome || `Linha ${numeroLinha}`,
      dataAdmissao,
      dataNascimento: mapeamento.dataNascimento ? parseDataAdmissao(linha[mapeamento.dataNascimento]) : null,
      salarioBase,
      dependentes: Number.isFinite(dependentes) && dependentes > 0 ? Math.floor(dependentes) : 0,
      cpf: opcional("cpf"),
      email: opcional("email"),
      cargo: opcional("cargo"),
      departamento: opcional("departamento"),
      vinculo: opcional("vinculo"),
      liderDiretoNome: opcional("liderDireto"),
      alimentacaoValor: alimentacaoValor !== null && Number.isFinite(alimentacaoValor) ? alimentacaoValor : null,
      cbo: opcional("cbo"),
      cidade: opcional("cidade"),
      agencia: opcional("agencia"),
      conta: opcional("conta"),
    });
  });

  return { colaboradores, descartadas };
}
