import "server-only";
import { getDb } from "./client";

export type Vinculo = "CLT" | "CLT-bio" | "PJ" | "EST" | "JÁ";
export type TipoTransporte = "vt_diario" | "vm_fixo";
export type StatusColaborador = "ativo" | "desligado";

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
  /** Nome do líder direto conforme registro externo (planilha) quando esse líder ainda não tem cadastro próprio — exibido como texto simples; se `gestorId` existir, ele prevalece. */
  liderDiretoNome: string | null;
  status: StatusColaborador;
  dataDesligamento: string | null;
  motivoDesligamento: string | null;
  valorRescisao: number | null;
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
  liderDiretoNome?: string | null;
  status?: StatusColaborador;
  dataDesligamento?: string | null;
  motivoDesligamento?: string | null;
  valorRescisao?: number | null;
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
  lider_direto_nome: string | null;
  status: StatusColaborador;
  data_desligamento: string | null;
  motivo_desligamento: string | null;
  valor_rescisao: number | null;
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
    liderDiretoNome: linha.lider_direto_nome,
    status: linha.status,
    dataDesligamento: linha.data_desligamento,
    motivoDesligamento: linha.motivo_desligamento,
    valorRescisao: linha.valor_rescisao,
  };
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  const db = await getDb();
  const resultado = await db.execute(
    // COLLATE NOCASE: sem isso, "ANA" (tudo maiúsculo, vindo de importação em lote) e "Bruno"
    // (Título, cadastro manual) ordenam por valor de byte — maiúsculas antes de minúsculas —
    // e não pela ordem alfabética que um humano espera.
    "SELECT * FROM colaboradores ORDER BY nome COLLATE NOCASE",
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
          vinculo, alimentacao_valor, data_nascimento, cbo, agencia, conta, tipo_transporte, valor_transporte_fixo,
          lider_direto_nome, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.liderDiretoNome ?? null,
      input.status ?? "ativo",
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
    liderDiretoNome: input.liderDiretoNome !== undefined ? input.liderDiretoNome : atual.liderDiretoNome,
    status: input.status ?? atual.status,
    dataDesligamento: input.dataDesligamento !== undefined ? input.dataDesligamento : atual.dataDesligamento,
    motivoDesligamento:
      input.motivoDesligamento !== undefined ? input.motivoDesligamento : atual.motivoDesligamento,
    valorRescisao: input.valorRescisao !== undefined ? input.valorRescisao : atual.valorRescisao,
  };

  const db = await getDb();
  await db.execute({
    sql: `UPDATE colaboradores
       SET nome = ?, data_admissao = ?, salario_base = ?, dependentes = ?, cpf = ?, email = ?, cargo = ?,
           departamento = ?, gestor_id = ?, cidade = ?, vinculo = ?, alimentacao_valor = ?, data_nascimento = ?,
           cbo = ?, agencia = ?, conta = ?, tipo_transporte = ?, valor_transporte_fixo = ?, lider_direto_nome = ?,
           status = ?, data_desligamento = ?, motivo_desligamento = ?, valor_rescisao = ?
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
      mesclado.liderDiretoNome ?? null,
      mesclado.status,
      mesclado.dataDesligamento ?? null,
      mesclado.motivoDesligamento ?? null,
      mesclado.valorRescisao ?? null,
      id,
    ],
  });
  return (await buscarColaborador(id))!;
}

export interface ImportacaoColaboradores {
  criados: number;
  descartados: { linha: number; motivo: string }[];
}

/** Insere um lote de colaboradores (vindo da importação de planilha). */
export async function importarColaboradores(itens: ColaboradorInput[]): Promise<ImportacaoColaboradores> {
  let criados = 0;
  for (const item of itens) {
    await criarColaborador(item);
    criados++;
  }
  return { criados, descartados: [] };
}
