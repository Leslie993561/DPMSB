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
  | "tipoTransporte"
  | "valorTransporteDia"
  | "valorTransporteFixo"
  | "rateioD365"
  | "periculosidadePercentual"
  | "insalubridadePercentual"
  | "adicionalFixo"
  | "adicionalFixoDescricao"
  | "conjugeSexo"
  | "cbo"
  | "cidade"
  | "agencia"
  | "conta"
  | "pis"
  | "cidadeNascimento"
  | "ufNascimento"
  | "nomePai"
  | "nomeMae"
  | "telefone"
  | "sexo"
  | "emailPessoal"
  | "horario"
  | "banco"
  | "cep"
  | "estado"
  | "bairro"
  | "rua"
  | "numero"
  | "conjugeNome"
  | "conjugeCpf"
  | "conjugeNascimento";

/**
 * Os sinônimos de campos que disputam o mesmo termo (dois e-mails, duas
 * cidades, dois CPFs, duas datas de nascimento) listam PRIMEIRO a forma
 * completa e específica do cabeçalho — o motor tenta casamento exato em todos
 * os cabeçalhos antes de cair no parcial, então a forma específica ganha e
 * "E-mail pessoal" não é confundido com "E-mail profissional".
 */
const SINONIMOS_COLABORADOR: Record<CampoColaborador, string[]> = {
  nome: ["nome completo", "nome", "colaborador", "funcionario", "empregado"],
  dataAdmissao: ["admissao", "data admissao", "data de admissao", "dt admissao"],
  dataNascimento: ["nascimento", "data nascimento", "data de nascimento", "dt nascimento"],
  salarioBase: ["salario", "salario base", "salario-base", "vencimento", "remuneracao"],
  // Só as formas no plural, e sem "numero de dependentes". O casamento parcial
  // é bidirecional, então: "numero de dependentes" fazia a coluna "Número" (do
  // endereço) virar quantidade de dependentes, e o singular "dependente" fazia
  // "Dependente 1 — Nome" virar quantidade. "Número de dependentes" continua
  // casando por conter "dependentes".
  dependentes: ["dependentes", "qtd dependentes", "deps"],
  cpf: ["cpf"],
  email: ["e mail profissional", "email profissional", "email", "e mail"],
  cargo: ["cargo", "cod cargo", "codigo cargo", "funcao"],
  departamento: ["departamento", "setor", "area"],
  vinculo: ["vinculo", "tipo de vinculo", "contrato"],
  liderDireto: ["lider direto", "lider", "gestor", "gestor responsavel"],
  alimentacaoValor: ["alimentacao", "vale alimentacao", "va", "vale refeicao", "vr", "refeicao"],
  // "Vale" é o cabeçalho da planilha de transporte do DP: a célula diz VT ou VM.
  tipoTransporte: ["vale", "tipo de transporte", "tipo transporte", "transporte", "beneficio transporte"],
  valorTransporteDia: ["valor por dia util", "valor por dia", "valor dia", "vt dia", "vt por dia"],
  valorTransporteFixo: ["valor fixo", "vm", "vale mobilidade", "transporte fixo", "valor mensal transporte"],
  rateioD365: ["rateio d365", "rateio", "d365", "centro de custo", "centro de rateio"],
  periculosidadePercentual: ["periculosidade", "periculosidade %", "adicional de periculosidade"],
  insalubridadePercentual: ["insalubridade", "insalubridade %", "adicional de insalubridade"],
  adicionalFixo: ["adicional fixo", "adicional fixo r$", "outros adicionais"],
  adicionalFixoDescricao: ["adicional fixo descricao", "descricao do adicional fixo", "adicional fixo — descricao"],
  conjugeSexo: ["conjuge sexo", "sexo do conjuge", "conjunge sexo"],
  cbo: ["cbo"],
  cidade: ["cidade", "municipio"],
  agencia: ["agencia"],
  conta: ["conta", "conta corrente"],
  pis: ["pis", "pis pasep", "nit"],
  cidadeNascimento: ["cidade de nascimento", "cidade nascimento", "naturalidade", "cid nasc"],
  ufNascimento: ["uf de nascimento", "uf nascimento", "uf nasc"],
  nomePai: ["nome do pai", "nome pai", "pai", "nom pai"],
  nomeMae: ["nome da mae", "nome mae", "mae", "nom mae"],
  telefone: ["telefone", "celular", "tell", "tel", "fone"],
  sexo: ["sexo", "genero"],
  emailPessoal: ["e mail pessoal", "email pessoal"],
  horario: ["horario", "jornada", "horario jornada"],
  banco: ["banco"],
  cep: ["cep"],
  estado: ["estado", "uf"],
  bairro: ["bairro"],
  rua: ["rua", "logradouro", "endereco"],
  numero: ["numero", "num", "nro"],
  // "Cônjunge" com o N extra é a grafia da planilha-mestre do DP; sem ela, o
  // grupo desambiguado ("Cônjunge · Nome") não casava com nada.
  conjugeNome: ["conjuge nome", "nome do conjuge", "conjuge", "conjunge nome", "conjunge"],
  conjugeCpf: ["conjuge cpf", "cpf do conjuge", "conjunge cpf"],
  conjugeNascimento: ["conjuge nascimento", "nascimento do conjuge", "conjunge nascimento"],
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
  tipoTransporte: false,
  valorTransporteDia: false,
  valorTransporteFixo: false,
  rateioD365: false,
  periculosidadePercentual: false,
  insalubridadePercentual: false,
  adicionalFixo: false,
  adicionalFixoDescricao: false,
  conjugeSexo: false,
  cbo: false,
  cidade: false,
  agencia: false,
  conta: false,
  pis: false,
  cidadeNascimento: false,
  ufNascimento: false,
  nomePai: false,
  nomeMae: false,
  telefone: false,
  sexo: false,
  emailPessoal: false,
  horario: false,
  banco: false,
  cep: false,
  estado: false,
  bairro: false,
  rua: false,
  numero: false,
  conjugeNome: false,
  conjugeCpf: false,
  conjugeNascimento: false,
};

/**
 * Todos os campos que a importação de colaborador reconhece.
 *
 * Existe para que o schema da rota seja DERIVADO daqui, e não uma segunda
 * lista escrita à mão. Três campos já foram perdidos exatamente assim: o valor
 * do VT por dia, os adicionais e o rateio D365 chegavam da planilha, o zod da
 * rota não os declarava, e a importação respondia "atualizado" sem gravar.
 */
export const CAMPOS_COLABORADOR = Object.keys(OBRIGATORIOS_COLABORADOR) as CampoColaborador[];

export function sugerirMapeamentoColaborador(cabecalhos: string[]): SugestaoColuna<CampoColaborador>[] {
  return sugerirMapeamentoGenerico(cabecalhos, SINONIMOS_COLABORADOR, OBRIGATORIOS_COLABORADOR);
}

export interface DependenteImportado {
  nome: string;
  dataNascimento: string | null; // ISO
  cpf: string | null;
}

export interface ColaboradorImportado {
  nome: string;
  /** `null` só em planilha de atualização, que não cria ninguém. */
  dataAdmissao: string | null; // ISO
  dataNascimento: string | null; // ISO
  salarioBase: number | null;
  dependentes: number;
  cpf: string | null;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  /** Nome do líder direto conforme a planilha — resolvido para gestorId numa etapa posterior (após todos os colaboradores existirem). */
  liderDiretoNome: string | null;
  alimentacaoValor: number | null;
  /** "vt_diario" ou "vm_fixo"; `null` = a planilha não fala de transporte e o cadastro fica como está. */
  tipoTransporte: string | null;
  valorTransporteDia: number | null;
  valorTransporteFixo: number | null;
  /** "ADM" ou "PRO"; qualquer outro texto vira null, para não classificar por engano. */
  rateioD365: string | null;
  periculosidadePercentual: number | null;
  insalubridadePercentual: number | null;
  adicionalFixo: number | null;
  adicionalFixoDescricao: string | null;
  conjugeSexo: string | null;
  cbo: string | null;
  cidade: string | null;
  agencia: string | null;
  conta: string | null;
  pis: string | null;
  cidadeNascimento: string | null;
  ufNascimento: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  telefone: string | null;
  sexo: "M" | "F" | null;
  emailPessoal: string | null;
  horario: string | null;
  banco: string | null;
  cep: string | null;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  conjugeNome: string | null;
  conjugeCpf: string | null;
  conjugeNascimento: string | null;
  /** Lidos das colunas "Dependente N — Nome/Nascimento/CPF" (padrão do modelo/exportação), não do mapeamento manual. */
  dependentesLista: DependenteImportado[];
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

  // Planilha SEM salário e SEM admissão é de atualização: só mexe em quem já
  // está no quadro. É o formato que o DP usa para mandar uma informação
  // isolada — o vale-transporte de cada um, por exemplo — sem repetir o
  // cadastro inteiro. Exigir as duas colunas aí só obrigaria a inventá-las.
  const modoAtualizacao = !colunaSalario && !colunaAdmissao;
  if (!modoAtualizacao) {
    if (!colunaSalario) throw new Error("A coluna de salário base é obrigatória e não foi mapeada.");
    if (!colunaAdmissao) throw new Error("A coluna de data de admissão é obrigatória e não foi mapeada.");
  }
  if (!mapeamento.nome) {
    throw new Error("A coluna de nome é obrigatória e não foi mapeada.");
  }

  const colaboradores: ColaboradorImportado[] = [];
  const descartadas: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;

    const salarioBruto = colunaSalario ? linha[colunaSalario] : null;
    const salarioLido =
      typeof salarioBruto === "number" ? salarioBruto : Number(String(salarioBruto ?? "").replace(",", "."));
    const salarioBase = Number.isFinite(salarioLido) && salarioLido > 0 ? salarioLido : null;
    if (!modoAtualizacao && salarioBase === null) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Salário base inválido ou ausente (valor lido: "${salarioBruto ?? ""}").`,
      });
      return;
    }

    const admissaoBruta = colunaAdmissao ? linha[colunaAdmissao] : null;
    const dataAdmissao = parseDataAdmissao(admissaoBruta);
    if (!modoAtualizacao && !dataAdmissao) {
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

    const numero = (campo: CampoColaborador): number | null => {
      const coluna = mapeamento[campo];
      if (!coluna) return null;
      const v = linha[coluna];
      if (v === null || v === "") return null;
      const n = Number(typeof v === "number" ? v : String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    // A planilha de transporte do DP traz só "VT" ou "VM" na coluna "Vale".
    // Qualquer outro texto vira null: melhor deixar o cadastro como está do que
    // reclassificar o benefício de alguém por uma palavra que ninguém sabe ler.
    const valeBruto = (opcional("tipoTransporte") ?? "").toLowerCase();
    const tipoTransporte = valeBruto.startsWith("vm")
      ? "vm_fixo"
      : valeBruto.startsWith("vt")
        ? "vt_diario"
        : null;

    // Só "ADM" e "PRO" existem no D365; qualquer outra coisa fica null, para o
    // cadastro não ser reclassificado por um texto que ninguém sabe ler.
    const rateioBruto = (opcional("rateioD365") ?? "").trim().toUpperCase();
    const rateioD365 = rateioBruto === "ADM" || rateioBruto === "PRO" ? rateioBruto : null;

    const sexoConjugeBruto = (opcional("conjugeSexo") ?? "").trim().toUpperCase();
    const sexoDoConjuge = sexoConjugeBruto.startsWith("M")
      ? "M"
      : sexoConjugeBruto.startsWith("F")
        ? "F"
        : null;

    const dependentesLista = lerDependentesDaLinha(linha);

    colaboradores.push({
      nome: nome || `Linha ${numeroLinha}`,
      dataAdmissao,
      dataNascimento: mapeamento.dataNascimento ? parseDataAdmissao(linha[mapeamento.dataNascimento]) : null,
      salarioBase,
      // A contagem vale a lista de dependentes lida da planilha quando ela
      // existe — o número solto só é usado se não houver dependente detalhado.
      dependentes:
        dependentesLista.length > 0
          ? dependentesLista.length
          : Number.isFinite(dependentes) && dependentes > 0
            ? Math.floor(dependentes)
            : 0,
      cpf: opcional("cpf"),
      email: opcional("email"),
      cargo: opcional("cargo"),
      departamento: opcional("departamento"),
      vinculo: opcional("vinculo"),
      liderDiretoNome: opcional("liderDireto"),
      alimentacaoValor: alimentacaoValor !== null && Number.isFinite(alimentacaoValor) ? alimentacaoValor : null,
      tipoTransporte,
      valorTransporteDia: numero("valorTransporteDia"),
      valorTransporteFixo: numero("valorTransporteFixo"),
      rateioD365,
      periculosidadePercentual: numero("periculosidadePercentual"),
      insalubridadePercentual: numero("insalubridadePercentual"),
      adicionalFixo: numero("adicionalFixo"),
      adicionalFixoDescricao: opcional("adicionalFixoDescricao"),
      conjugeSexo: sexoDoConjuge,
      cbo: opcional("cbo"),
      cidade: opcional("cidade"),
      agencia: opcional("agencia"),
      conta: opcional("conta"),
      pis: opcional("pis"),
      cidadeNascimento: opcional("cidadeNascimento"),
      ufNascimento: opcional("ufNascimento"),
      nomePai: opcional("nomePai"),
      nomeMae: opcional("nomeMae"),
      telefone: opcional("telefone"),
      sexo: normalizarSexo(opcional("sexo")),
      emailPessoal: opcional("emailPessoal"),
      horario: opcional("horario"),
      banco: opcional("banco"),
      cep: opcional("cep"),
      estado: opcional("estado"),
      bairro: opcional("bairro"),
      rua: opcional("rua"),
      numero: opcional("numero"),
      conjugeNome: opcional("conjugeNome"),
      conjugeCpf: opcional("conjugeCpf"),
      conjugeNascimento: mapeamento.conjugeNascimento
        ? parseDataAdmissao(linha[mapeamento.conjugeNascimento])
        : null,
      dependentesLista,
    });
  });

  return { colaboradores, descartadas };
}

/** "Masculino"/"m" → "M"; "Feminino"/"f" → "F"; qualquer outra coisa → null (nunca adivinha). */
function normalizarSexo(valor: string | null): "M" | "F" | null {
  if (!valor) return null;
  const inicial = normalizar(valor).charAt(0);
  if (inicial === "m") return "M";
  if (inicial === "f") return "F";
  return null;
}

/**
 * Lê os dependentes das colunas "Dependente N — Nome/Nascimento/CPF" (o padrão
 * que o modelo e a exportação geram), em vez do mapeamento manual — são
 * colunas repetidas e variáveis em quantidade, que não caberiam num
 * mapeamento campo→coluna único. Dependente sem nome é ignorado.
 */
function lerDependentesDaLinha(linha: LinhaPlanilha): DependenteImportado[] {
  const porIndice = new Map<number, { nome?: string; nascimento?: string | null; cpf?: string }>();

  for (const [cabecalho, valor] of Object.entries(linha)) {
    const norm = normalizar(cabecalho);
    const casamento = norm.match(/^dependente (\d+)\s+(nome|nascimento|cpf)$/);
    if (!casamento) continue;

    const indice = Number(casamento[1]);
    const campo = casamento[2];
    const atual = porIndice.get(indice) ?? {};
    const texto = valor === null || valor === "" ? "" : String(valor).trim();

    if (campo === "nome") atual.nome = texto;
    else if (campo === "cpf") atual.cpf = texto;
    else atual.nascimento = parseDataAdmissao(valor);

    porIndice.set(indice, atual);
  }

  return Array.from(porIndice.entries())
    .sort(([a], [b]) => a - b)
    .filter(([, d]) => d.nome)
    .map(([, d]) => ({ nome: d.nome!, dataNascimento: d.nascimento ?? null, cpf: d.cpf || null }));
}
