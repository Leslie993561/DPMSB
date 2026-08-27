import "server-only";
import { getDb } from "./client";
import { substituirDependentes } from "./colaboradorDependentes";
import { casarPorNome } from "@/lib/folha/casarNome";
import { acharParecido } from "@/lib/folha/parecidos";

export type Vinculo = "CLT" | "CLT-bio" | "PJ" | "EST" | "JÁ";
export type TipoTransporte = "vt_diario" | "vm_fixo";
export type StatusColaborador = "ativo" | "desligado";
export type SexoColaborador = "M" | "F";

export interface Colaborador {
  id: number;
  nome: string;
  dataAdmissao: string;
  salarioBase: number;
  dependentes: number;
  cpf: string | null;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  gestorId: number | null;
  cidade: string | null;
  vinculo: Vinculo | null;
  alimentacaoValor: number | null;
  dataNascimento: string | null;
  cbo: string | null;
  agencia: string | null;
  conta: string | null;
  tipoTransporte: TipoTransporte;
  valorTransporteFixo: number | null;
  /** VT: valor de um dia útil, ida e volta somadas — como o DP informa. */
  valorTransporteDia: number | null;
  /** Nome do líder direto conforme registro externo (planilha) quando esse líder ainda não tem cadastro próprio — exibido como texto simples; se `gestorId` existir, ele prevalece. */
  liderDiretoNome: string | null;
  status: StatusColaborador;
  dataDesligamento: string | null;
  motivoDesligamento: string | null;
  valorRescisao: number | null;
  // Dados pessoais
  pis: string | null;
  cidadeNascimento: string | null;
  ufNascimento: string | null;
  nomePai: string | null;
  nomeMae: string | null;
  telefone: string | null;
  sexo: SexoColaborador | null;
  emailPessoal: string | null;
  // Dados profissionais
  horario: string | null;
  // Dados bancários
  banco: string | null;
  // Endereço
  cep: string | null;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  // Cônjuge
  conjugeNome: string | null;
  conjugeCpf: string | null;
  conjugeNascimento: string | null;
  conjugeSexo: SexoColaborador | null;
  /**
   * Adicionais guardados como PERCENTUAL, não como valor: periculosidade incide
   * sobre o salário base (Art. 193 §1º CLT) e insalubridade sobre o salário
   * mínimo (Art. 192). Congelar o valor calculado deixaria o cadastro errado a
   * cada dissídio e a cada mínimo novo.
   */
  periculosidadePercentual: number | null;
  insalubridadePercentual: number | null;
  /** Adicional em reais que não segue percentual — quebra de caixa, ajuda de custo fixa etc. */
  adicionalFixo: number | null;
  adicionalFixoDescricao: string | null;
}

export interface ColaboradorInput {
  nome: string;
  dataAdmissao: string;
  salarioBase: number;
  dependentes?: number;
  cpf?: string | null;
  email?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  gestorId?: number | null;
  cidade?: string | null;
  vinculo?: Vinculo | null;
  alimentacaoValor?: number | null;
  dataNascimento?: string | null;
  cbo?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipoTransporte?: TipoTransporte;
  valorTransporteFixo?: number | null;
  valorTransporteDia?: number | null;
  liderDiretoNome?: string | null;
  status?: StatusColaborador;
  dataDesligamento?: string | null;
  motivoDesligamento?: string | null;
  valorRescisao?: number | null;
  pis?: string | null;
  cidadeNascimento?: string | null;
  ufNascimento?: string | null;
  nomePai?: string | null;
  nomeMae?: string | null;
  telefone?: string | null;
  sexo?: SexoColaborador | null;
  emailPessoal?: string | null;
  horario?: string | null;
  banco?: string | null;
  cep?: string | null;
  estado?: string | null;
  bairro?: string | null;
  rua?: string | null;
  numero?: string | null;
  conjugeNome?: string | null;
  conjugeCpf?: string | null;
  conjugeNascimento?: string | null;
  conjugeSexo?: SexoColaborador | null;
  periculosidadePercentual?: number | null;
  insalubridadePercentual?: number | null;
  adicionalFixo?: number | null;
  adicionalFixoDescricao?: string | null;
}

interface LinhaColaborador {
  id: number;
  nome: string;
  data_admissao: string;
  salario_base: number;
  dependentes: number;
  cpf: string | null;
  email: string | null;
  cargo: string | null;
  departamento: string | null;
  gestor_id: number | null;
  cidade: string | null;
  vinculo: Vinculo | null;
  alimentacao_valor: number | null;
  data_nascimento: string | null;
  cbo: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_transporte: TipoTransporte;
  valor_transporte_fixo: number | null;
  valor_transporte_dia: number | null;
  lider_direto_nome: string | null;
  status: StatusColaborador;
  data_desligamento: string | null;
  motivo_desligamento: string | null;
  valor_rescisao: number | null;
  pis: string | null;
  cidade_nascimento: string | null;
  uf_nascimento: string | null;
  nome_pai: string | null;
  nome_mae: string | null;
  telefone: string | null;
  sexo: SexoColaborador | null;
  email_pessoal: string | null;
  horario: string | null;
  banco: string | null;
  cep: string | null;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  periculosidade_percentual: number | null;
  insalubridade_percentual: number | null;
  adicional_fixo: number | null;
  adicional_fixo_descricao: string | null;
  conjuge_nome: string | null;
  conjuge_cpf: string | null;
  conjuge_nascimento: string | null;
  conjuge_sexo: string | null;
}

function paraColaborador(linha: LinhaColaborador): Colaborador {
  return {
    id: linha.id,
    nome: linha.nome,
    dataAdmissao: linha.data_admissao,
    salarioBase: linha.salario_base,
    dependentes: linha.dependentes,
    cpf: linha.cpf,
    email: linha.email,
    cargo: linha.cargo,
    departamento: linha.departamento,
    gestorId: linha.gestor_id,
    cidade: linha.cidade,
    vinculo: linha.vinculo,
    alimentacaoValor: linha.alimentacao_valor,
    dataNascimento: linha.data_nascimento,
    cbo: linha.cbo,
    agencia: linha.agencia,
    conta: linha.conta,
    tipoTransporte: linha.tipo_transporte,
    valorTransporteFixo: linha.valor_transporte_fixo,
    valorTransporteDia: linha.valor_transporte_dia,
    liderDiretoNome: linha.lider_direto_nome,
    status: linha.status,
    dataDesligamento: linha.data_desligamento,
    motivoDesligamento: linha.motivo_desligamento,
    valorRescisao: linha.valor_rescisao,
    pis: linha.pis,
    cidadeNascimento: linha.cidade_nascimento,
    ufNascimento: linha.uf_nascimento,
    nomePai: linha.nome_pai,
    nomeMae: linha.nome_mae,
    telefone: linha.telefone,
    sexo: linha.sexo,
    emailPessoal: linha.email_pessoal,
    horario: linha.horario,
    banco: linha.banco,
    cep: linha.cep,
    estado: linha.estado,
    bairro: linha.bairro,
    rua: linha.rua,
    numero: linha.numero,
    conjugeNome: linha.conjuge_nome,
    conjugeCpf: linha.conjuge_cpf,
    conjugeNascimento: linha.conjuge_nascimento,
    conjugeSexo: linha.conjuge_sexo as SexoColaborador | null,
    periculosidadePercentual: linha.periculosidade_percentual,
    insalubridadePercentual: linha.insalubridade_percentual,
    adicionalFixo: linha.adicional_fixo,
    adicionalFixoDescricao: linha.adicional_fixo_descricao,
  };
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  const db = await getDb();
  const resultado = await db.execute(
    // lower(nome): sem isso, "ANA" (tudo maiúsculo, vindo de importação em lote) e "Bruno"
    // (Título, cadastro manual) ordenam por valor de byte — maiúsculas antes de minúsculas —
    // e não pela ordem alfabética que um humano espera.
    "SELECT * FROM colaboradores ORDER BY lower(nome)",
  );
  return (resultado.rows as unknown as LinhaColaborador[]).map(paraColaborador);
}

export async function buscarColaborador(id: number): Promise<Colaborador | null> {
  const db = await getDb();
  const resultado = await db.execute({ sql: "SELECT * FROM colaboradores WHERE id = ?", args: [id] });
  const linha = resultado.rows[0] as unknown as LinhaColaborador | undefined;
  return linha ? paraColaborador(linha) : null;
}

/** Busca por nome (usado para resolver "líder direto" vindo de planilha, sem depender de IDs). */
export async function buscarColaboradorPorNome(nome: string): Promise<Colaborador | null> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM colaboradores WHERE lower(nome) = lower(?)",
    args: [nome.trim()],
  });
  const linha = resultado.rows[0] as unknown as LinhaColaborador | undefined;
  return linha ? paraColaborador(linha) : null;
}

export async function criarColaborador(input: ColaboradorInput): Promise<Colaborador> {
  const db = await getDb();
  const info = await db.execute({
    sql: `INSERT INTO colaboradores
         (nome, data_admissao, salario_base, dependentes, cpf, email, cargo, departamento, gestor_id, cidade,
          vinculo, alimentacao_valor, data_nascimento, cbo, agencia, conta, tipo_transporte, valor_transporte_fixo, valor_transporte_dia,
          lider_direto_nome, status, pis, cidade_nascimento, uf_nascimento, nome_pai, nome_mae, telefone, sexo,
          email_pessoal, horario, banco, cep, estado, bairro, rua, numero, conjuge_nome, conjuge_cpf, conjuge_nascimento, conjuge_sexo,
          periculosidade_percentual, insalubridade_percentual, adicional_fixo, adicional_fixo_descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.nome,
      input.dataAdmissao,
      input.salarioBase,
      input.dependentes ?? 0,
      input.cpf ?? null,
      input.email ?? null,
      input.cargo ?? null,
      input.departamento ?? null,
      input.gestorId ?? null,
      input.cidade ?? null,
      input.vinculo ?? null,
      input.alimentacaoValor ?? null,
      input.dataNascimento ?? null,
      input.cbo ?? null,
      input.agencia ?? null,
      input.conta ?? null,
      input.tipoTransporte ?? "vt_diario",
      input.valorTransporteFixo ?? null,
      input.valorTransporteDia ?? null,
      input.liderDiretoNome ?? null,
      input.status ?? "ativo",
      input.pis ?? null,
      input.cidadeNascimento ?? null,
      input.ufNascimento ?? null,
      input.nomePai ?? null,
      input.nomeMae ?? null,
      input.telefone ?? null,
      input.sexo ?? null,
      input.emailPessoal ?? null,
      input.horario ?? null,
      input.banco ?? null,
      input.cep ?? null,
      input.estado ?? null,
      input.bairro ?? null,
      input.rua ?? null,
      input.numero ?? null,
      input.conjugeNome ?? null,
      input.conjugeCpf ?? null,
      input.conjugeNascimento ?? null,
      input.conjugeSexo ?? null,
      input.periculosidadePercentual ?? null,
      input.insalubridadePercentual ?? null,
      input.adicionalFixo ?? null,
      input.adicionalFixoDescricao ?? null,
    ],
  });
  return (await buscarColaborador(Number(info.lastInsertRowid)))!;
}

export async function atualizarColaborador(id: number, input: Partial<ColaboradorInput>): Promise<Colaborador> {
  const atual = await buscarColaborador(id);
  if (!atual) throw new Error(`Colaborador ${id} não encontrado.`);

  const mesclado: Required<Omit<ColaboradorInput, "dependentes">> & { dependentes: number } = {
    nome: input.nome ?? atual.nome,
    dataAdmissao: input.dataAdmissao ?? atual.dataAdmissao,
    salarioBase: input.salarioBase ?? atual.salarioBase,
    dependentes: input.dependentes ?? atual.dependentes,
    cpf: input.cpf !== undefined ? input.cpf : atual.cpf,
    email: input.email !== undefined ? input.email : atual.email,
    cargo: input.cargo !== undefined ? input.cargo : atual.cargo,
    departamento: input.departamento !== undefined ? input.departamento : atual.departamento,
    gestorId: input.gestorId !== undefined ? input.gestorId : atual.gestorId,
    cidade: input.cidade !== undefined ? input.cidade : atual.cidade,
    vinculo: input.vinculo !== undefined ? input.vinculo : atual.vinculo,
    alimentacaoValor: input.alimentacaoValor !== undefined ? input.alimentacaoValor : atual.alimentacaoValor,
    dataNascimento: input.dataNascimento !== undefined ? input.dataNascimento : atual.dataNascimento,
    cbo: input.cbo !== undefined ? input.cbo : atual.cbo,
    agencia: input.agencia !== undefined ? input.agencia : atual.agencia,
    conta: input.conta !== undefined ? input.conta : atual.conta,
    tipoTransporte: input.tipoTransporte ?? atual.tipoTransporte,
    valorTransporteFixo:
      input.valorTransporteFixo !== undefined ? input.valorTransporteFixo : atual.valorTransporteFixo,
    valorTransporteDia:
      input.valorTransporteDia !== undefined ? input.valorTransporteDia : atual.valorTransporteDia,
    liderDiretoNome: input.liderDiretoNome !== undefined ? input.liderDiretoNome : atual.liderDiretoNome,
    status: input.status ?? atual.status,
    dataDesligamento: input.dataDesligamento !== undefined ? input.dataDesligamento : atual.dataDesligamento,
    motivoDesligamento:
      input.motivoDesligamento !== undefined ? input.motivoDesligamento : atual.motivoDesligamento,
    valorRescisao: input.valorRescisao !== undefined ? input.valorRescisao : atual.valorRescisao,
    pis: input.pis !== undefined ? input.pis : atual.pis,
    cidadeNascimento: input.cidadeNascimento !== undefined ? input.cidadeNascimento : atual.cidadeNascimento,
    ufNascimento: input.ufNascimento !== undefined ? input.ufNascimento : atual.ufNascimento,
    nomePai: input.nomePai !== undefined ? input.nomePai : atual.nomePai,
    nomeMae: input.nomeMae !== undefined ? input.nomeMae : atual.nomeMae,
    telefone: input.telefone !== undefined ? input.telefone : atual.telefone,
    sexo: input.sexo !== undefined ? input.sexo : atual.sexo,
    emailPessoal: input.emailPessoal !== undefined ? input.emailPessoal : atual.emailPessoal,
    horario: input.horario !== undefined ? input.horario : atual.horario,
    banco: input.banco !== undefined ? input.banco : atual.banco,
    cep: input.cep !== undefined ? input.cep : atual.cep,
    estado: input.estado !== undefined ? input.estado : atual.estado,
    bairro: input.bairro !== undefined ? input.bairro : atual.bairro,
    rua: input.rua !== undefined ? input.rua : atual.rua,
    numero: input.numero !== undefined ? input.numero : atual.numero,
    conjugeNome: input.conjugeNome !== undefined ? input.conjugeNome : atual.conjugeNome,
    conjugeCpf: input.conjugeCpf !== undefined ? input.conjugeCpf : atual.conjugeCpf,
    conjugeNascimento: input.conjugeNascimento !== undefined ? input.conjugeNascimento : atual.conjugeNascimento,
    conjugeSexo: input.conjugeSexo !== undefined ? input.conjugeSexo : atual.conjugeSexo,
    periculosidadePercentual:
      input.periculosidadePercentual !== undefined ? input.periculosidadePercentual : atual.periculosidadePercentual,
    insalubridadePercentual:
      input.insalubridadePercentual !== undefined ? input.insalubridadePercentual : atual.insalubridadePercentual,
    adicionalFixo: input.adicionalFixo !== undefined ? input.adicionalFixo : atual.adicionalFixo,
    adicionalFixoDescricao:
      input.adicionalFixoDescricao !== undefined ? input.adicionalFixoDescricao : atual.adicionalFixoDescricao,
  };

  const db = await getDb();
  await db.execute({
    sql: `UPDATE colaboradores
       SET nome = ?, data_admissao = ?, salario_base = ?, dependentes = ?, cpf = ?, email = ?, cargo = ?,
           departamento = ?, gestor_id = ?, cidade = ?, vinculo = ?, alimentacao_valor = ?, data_nascimento = ?,
           cbo = ?, agencia = ?, conta = ?, tipo_transporte = ?, valor_transporte_fixo = ?, valor_transporte_dia = ?, lider_direto_nome = ?,
           status = ?, data_desligamento = ?, motivo_desligamento = ?, valor_rescisao = ?,
           pis = ?, cidade_nascimento = ?, uf_nascimento = ?, nome_pai = ?, nome_mae = ?, telefone = ?, sexo = ?,
           email_pessoal = ?, horario = ?, banco = ?, cep = ?, estado = ?, bairro = ?, rua = ?, numero = ?,
           conjuge_nome = ?, conjuge_cpf = ?, conjuge_nascimento = ?, conjuge_sexo = ?,
           periculosidade_percentual = ?, insalubridade_percentual = ?, adicional_fixo = ?,
           adicional_fixo_descricao = ?
       WHERE id = ?`,
    args: [
      mesclado.nome,
      mesclado.dataAdmissao,
      mesclado.salarioBase,
      mesclado.dependentes,
      mesclado.cpf ?? null,
      mesclado.email ?? null,
      mesclado.cargo ?? null,
      mesclado.departamento ?? null,
      mesclado.gestorId ?? null,
      mesclado.cidade ?? null,
      mesclado.vinculo ?? null,
      mesclado.alimentacaoValor ?? null,
      mesclado.dataNascimento ?? null,
      mesclado.cbo ?? null,
      mesclado.agencia ?? null,
      mesclado.conta ?? null,
      mesclado.tipoTransporte,
      mesclado.valorTransporteFixo ?? null,
      mesclado.valorTransporteDia ?? null,
      mesclado.liderDiretoNome ?? null,
      mesclado.status,
      mesclado.dataDesligamento ?? null,
      mesclado.motivoDesligamento ?? null,
      mesclado.valorRescisao ?? null,
      mesclado.pis ?? null,
      mesclado.cidadeNascimento ?? null,
      mesclado.ufNascimento ?? null,
      mesclado.nomePai ?? null,
      mesclado.nomeMae ?? null,
      mesclado.telefone ?? null,
      mesclado.sexo ?? null,
      mesclado.emailPessoal ?? null,
      mesclado.horario ?? null,
      mesclado.banco ?? null,
      mesclado.cep ?? null,
      mesclado.estado ?? null,
      mesclado.bairro ?? null,
      mesclado.rua ?? null,
      mesclado.numero ?? null,
      mesclado.conjugeNome ?? null,
      mesclado.conjugeCpf ?? null,
      mesclado.conjugeNascimento ?? null,
      mesclado.conjugeSexo ?? null,
      mesclado.periculosidadePercentual ?? null,
      mesclado.insalubridadePercentual ?? null,
      mesclado.adicionalFixo ?? null,
      mesclado.adicionalFixoDescricao ?? null,
      id,
    ],
  });
  return (await buscarColaborador(id))!;
}

export interface ImportacaoColaboradores {
  criados: number;
  /** Já existiam e foram atualizados com o que veio na planilha. */
  atualizados: number;
  /**
   * Setor ou cargo que chegou quase igual a um que já existe. Não é corrigido
   * sozinho — só apontado. Uma letra trocada cria um setor novo em silêncio, e
   * foi assim que "mantenção" passou a conviver com "Manutenção" na tela.
   */
  parecidos: { linha: number; campo: string; valor: string; parecidoCom: string }[];
  descartados: { linha: number; motivo: string }[];
}

/** Só os dígitos do CPF — a planilha ora traz pontuação, ora não. */
function digitosCpf(cpf: string | null | undefined): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/**
 * Uma linha de planilha de colaborador.
 *
 * Admissão e salário são anuláveis porque a planilha pode ser de ATUALIZAÇÃO —
 * uma coluna só, para quem já está no quadro (o vale-transporte de cada um, por
 * exemplo). Nesse caso não há o que criar, e a linha que não achar dono é
 * descartada com o motivo explícito em vez de virar um cadastro pela metade.
 */
export interface ColaboradorInputComDependentes extends Omit<ColaboradorInput, "dataAdmissao" | "salarioBase"> {
  dataAdmissao: string | null;
  salarioBase: number | null;
  dependentesLista?: { nome: string; dataNascimento?: string | null; cpf?: string | null }[];
}

/**
 * Aplica um lote de colaboradores vindo de planilha.
 *
 * Quem já existe é ATUALIZADO, não duplicado. Antes esta função só criava, e
 * reimportar a mesma planilha triplicava o cadastro inteiro — foi o que
 * aconteceu em produção, com 61 pessoas viradas 183 e as importações de folha
 * passando a recusar linhas por "casa com mais de um colaborador".
 *
 * O reconhecimento é por CPF (só os dígitos, porque a planilha ora pontua ora
 * não) e, na falta dele, pelo nome com a mesma tolerância a acento e conectivo
 * usada na folha. Nome que casa com mais de uma pessoa NÃO é atualizado às
 * cegas: vira uma linha descartada pedindo o CPF, porque escolher o registro
 * errado sobrescreveria o cadastro de outra pessoa.
 */
export async function importarColaboradores(
  itens: ColaboradorInputComDependentes[],
): Promise<ImportacaoColaboradores> {
  const existentes = await listarColaboradores();
  const porCpf = new Map<string, Colaborador>();
  for (const c of existentes) {
    const chave = digitosCpf(c.cpf);
    if (chave && !porCpf.has(chave)) porCpf.set(chave, c);
  }

  let criados = 0;
  let atualizados = 0;
  const descartados: ImportacaoColaboradores["descartados"] = [];
  const parecidos: ImportacaoColaboradores["parecidos"] = [];

  const setoresConhecidos = Array.from(
    new Set(existentes.map((c) => c.departamento).filter((d): d is string => Boolean(d))),
  );
  const cargosConhecidos = Array.from(new Set(existentes.map((c) => c.cargo).filter((c): c is string => Boolean(c))));

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2;
    const { dependentesLista, ...dadosColaborador } = item;
    const dados = {
      ...dadosColaborador,
      dependentes: dependentesLista?.length ?? dadosColaborador.dependentes ?? 0,
    };

    for (const [campo, valor, conhecidos] of [
      ["Departamento", dadosColaborador.departamento, setoresConhecidos],
      ["Cargo", dadosColaborador.cargo, cargosConhecidos],
    ] as const) {
      if (!valor) continue;
      const parecidoCom = acharParecido(valor, conhecidos);
      if (parecidoCom) parecidos.push({ linha, campo, valor, parecidoCom });
    }

    const cpf = digitosCpf(dadosColaborador.cpf);
    const porCpfAchado = cpf ? porCpf.get(cpf) : undefined;
    const casamento = porCpfAchado
      ? { encontrado: porCpfAchado, ambiguo: false }
      : casarPorNome(dadosColaborador.nome ?? "", existentes, (c) => c.nome);

    if (!casamento.encontrado && casamento.ambiguo) {
      descartados.push({
        linha,
        motivo: `"${dadosColaborador.nome}" casa com mais de um cadastro — informe o CPF para não sobrescrever a pessoa errada.`,
      });
      continue;
    }

    let colaborador: Colaborador;
    if (casamento.encontrado) {
      // Só o que a planilha realmente trouxe é gravado. Sem isto, uma coluna
      // ausente no arquivo (alimentação, por exemplo) chegaria como null e
      // apagaria o valor que já estava no cadastro — a mesma regra que vale na
      // importação de verbas: o que não vem na planilha fica como está.
      const informados = Object.fromEntries(
        Object.entries(dados).filter(([, valor]) => valor !== null && valor !== undefined),
      ) as Partial<ColaboradorInput>;
      colaborador = await atualizarColaborador(casamento.encontrado.id, informados);
      atualizados++;
    } else if (dados.dataAdmissao === null || dados.salarioBase === null) {
      descartados.push({
        linha,
        motivo: `"${dadosColaborador.nome}" não está no quadro de colaboradores. Esta planilha atualiza quem já existe — para cadastrar alguém novo ela precisa das colunas de admissão e salário.`,
      });
      continue;
    } else {
      colaborador = await criarColaborador({ ...dados, dataAdmissao: dados.dataAdmissao, salarioBase: dados.salarioBase });
      existentes.push(colaborador);
      if (cpf) porCpf.set(cpf, colaborador);
      criados++;
    }

    if (dependentesLista && dependentesLista.length > 0) {
      await substituirDependentes(colaborador.id, dependentesLista);
    }
  }

  return { criados, atualizados, parecidos, descartados };
}

export interface VinculosDoColaborador {
  periodosAquisitivos: number;
  lancamentosFerias: number;
  verbasImportadas: number;
  mesesFechados: number;
  liderados: number;
}

/** O que existe amarrado ao colaborador — o que impede apagá-lo sem perder histórico. */
export async function contarVinculos(colaboradorId: number): Promise<VinculosDoColaborador> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `SELECT
        (SELECT COUNT(*) FROM periodos_aquisitivos WHERE colaborador_id = ?) AS periodos,
        (SELECT COUNT(*) FROM lancamentos_ferias l
           JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
          WHERE p.colaborador_id = ?) AS lancamentos,
        (SELECT COUNT(*) FROM folha_extras WHERE colaborador_id = ?) AS extras,
        (SELECT COUNT(*) FROM folha_breakdown WHERE colaborador_id = ?) AS fechados,
        (SELECT COUNT(*) FROM colaboradores WHERE gestor_id = ?) AS liderados`,
    args: [colaboradorId, colaboradorId, colaboradorId, colaboradorId, colaboradorId],
  });
  const l = resultado.rows[0] as unknown as {
    periodos: number;
    lancamentos: number;
    extras: number;
    fechados: number;
    liderados: number;
  };
  return {
    periodosAquisitivos: Number(l.periodos),
    lancamentosFerias: Number(l.lancamentos),
    verbasImportadas: Number(l.extras),
    mesesFechados: Number(l.fechados),
    liderados: Number(l.liderados),
  };
}

/**
 * Apaga o colaborador de vez. Existe para o cadastro criado por engano — a
 * pessoa que "não vai para lugar nenhum" —, NÃO para quem saiu da empresa:
 * para esse caso existe o desligamento, que preserva o histórico.
 *
 * Por isso a exclusão é recusada quando há período de férias, lançamento,
 * verba importada, mês fechado ou liderado apontando para ele. Apagar assim
 * arrancaria pedaços de folha e de férias já apuradas, e nada disso volta.
 *
 * Os dependentes vão junto: eles só existem por causa do titular.
 */
export async function excluirColaborador(colaboradorId: number): Promise<void> {
  const db = await getDb();
  await db.batch([
    { sql: "DELETE FROM colaborador_dependentes WHERE colaborador_id = ?", args: [colaboradorId] },
    { sql: "DELETE FROM colaboradores WHERE id = ?", args: [colaboradorId] },
  ]);
}
