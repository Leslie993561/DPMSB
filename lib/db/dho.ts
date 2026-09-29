import "server-only";
import { getDb } from "./client";

export interface ItemEvento {
  id: number;
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface EventoCalendario {
  id: number;
  data: string;
  dataFim: string | null;
  titulo: string;
  objetivo: string;
  publicoAlvo: string;
  descricao: string;
  itens: ItemEvento[];
}

interface LinhaEvento {
  id: number;
  data: string;
  data_fim: string | null;
  titulo: string;
  objetivo: string;
  publico_alvo: string;
  descricao: string;
}

interface LinhaItemEvento {
  id: number;
  evento_id: number;
  nome: string;
  quantidade: number;
  valor_unitario: number;
}

export interface DadosEvento {
  data: string;
  dataFim: string | null;
  titulo: string;
  objetivo: string;
  publicoAlvo: string;
  descricao: string;
  itens: { nome: string; quantidade: number; valorUnitario: number }[];
}

export async function listarEventosCalendario(ano: number): Promise<EventoCalendario[]> {
  const db = await getDb();
  const eventos = await db.execute({
    sql: "SELECT id, data, data_fim, titulo, objetivo, publico_alvo, descricao FROM dho_eventos_calendario WHERE data LIKE ? ORDER BY data",
    args: [`${ano}-%`],
  });
  const linhas = eventos.rows as unknown as LinhaEvento[];
  if (linhas.length === 0) return [];

  const itens = await db.execute({
    sql: "SELECT id, evento_id, nome, quantidade, valor_unitario FROM dho_evento_itens WHERE evento_id = ANY(?::int[])",
    args: [linhas.map((l) => l.id)],
  });
  const linhasItens = itens.rows as unknown as LinhaItemEvento[];

  return linhas.map((l) => paraEvento(l, linhasItens.filter((i) => i.evento_id === l.id)));
}

function paraEvento(l: LinhaEvento, itens: LinhaItemEvento[]): EventoCalendario {
  return {
    id: l.id,
    data: l.data,
    dataFim: l.data_fim,
    titulo: l.titulo,
    objetivo: l.objetivo,
    publicoAlvo: l.publico_alvo,
    descricao: l.descricao,
    itens: itens.map((i) => ({ id: i.id, nome: i.nome, quantidade: i.quantidade, valorUnitario: i.valor_unitario })),
  };
}

async function salvarItensEvento(eventoId: number, itens: DadosEvento["itens"]): Promise<void> {
  const db = await getDb();
  await db.batch([
    { sql: "DELETE FROM dho_evento_itens WHERE evento_id = ?", args: [eventoId] },
    ...itens.map((i) => ({
      sql: "INSERT INTO dho_evento_itens (evento_id, nome, quantidade, valor_unitario) VALUES (?, ?, ?, ?)",
      args: [eventoId, i.nome, i.quantidade, i.valorUnitario],
    })),
  ]);
}

export async function criarEventoCalendario(dados: DadosEvento): Promise<EventoCalendario> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `INSERT INTO dho_eventos_calendario (data, data_fim, titulo, objetivo, publico_alvo, descricao)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id, data, data_fim, titulo, objetivo, publico_alvo, descricao`,
    args: [dados.data, dados.dataFim, dados.titulo, dados.objetivo, dados.publicoAlvo, dados.descricao],
  });
  const linha = (resultado.rows as unknown as LinhaEvento[])[0];
  await salvarItensEvento(linha.id, dados.itens);
  const itens = await db.execute({
    sql: "SELECT id, evento_id, nome, quantidade, valor_unitario FROM dho_evento_itens WHERE evento_id = ?",
    args: [linha.id],
  });
  return paraEvento(linha, itens.rows as unknown as LinhaItemEvento[]);
}

export async function atualizarEventoCalendario(id: number, dados: DadosEvento): Promise<EventoCalendario> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `UPDATE dho_eventos_calendario SET data = ?, data_fim = ?, titulo = ?, objetivo = ?, publico_alvo = ?, descricao = ?
          WHERE id = ? RETURNING id, data, data_fim, titulo, objetivo, publico_alvo, descricao`,
    args: [dados.data, dados.dataFim, dados.titulo, dados.objetivo, dados.publicoAlvo, dados.descricao, id],
  });
  const linha = (resultado.rows as unknown as LinhaEvento[])[0];
  await salvarItensEvento(id, dados.itens);
  const itens = await db.execute({
    sql: "SELECT id, evento_id, nome, quantidade, valor_unitario FROM dho_evento_itens WHERE evento_id = ?",
    args: [id],
  });
  return paraEvento(linha, itens.rows as unknown as LinhaItemEvento[]);
}

export async function excluirEventoCalendario(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM dho_eventos_calendario WHERE id = ?", args: [id] });
}

export type CategoriaDataComemorativa = "nacional" | "regional" | "ponte";

export interface DataComemorativa {
  id: number;
  data: string;
  nome: string;
  categoria: CategoriaDataComemorativa;
}

interface LinhaDataComemorativa {
  id: number;
  data: string;
  nome: string;
  categoria: CategoriaDataComemorativa;
}

/** Feriados/datas comemorativas marcados no Calendário — mais simples que uma ação: só data, nome e categoria (pra cor). */
export async function listarDatasComemorativas(ano: number): Promise<DataComemorativa[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT id, data, nome, categoria FROM dho_datas_comemorativas WHERE data LIKE ? ORDER BY data",
    args: [`${ano}-%`],
  });
  return resultado.rows as unknown as LinhaDataComemorativa[];
}

export async function criarDataComemorativa(dados: { data: string; nome: string; categoria: CategoriaDataComemorativa }): Promise<DataComemorativa> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "INSERT INTO dho_datas_comemorativas (data, nome, categoria) VALUES (?, ?, ?) RETURNING id, data, nome, categoria",
    args: [dados.data, dados.nome, dados.categoria],
  });
  return (resultado.rows as unknown as LinhaDataComemorativa[])[0];
}

export async function atualizarDataComemorativa(
  id: number,
  dados: { data: string; nome: string; categoria: CategoriaDataComemorativa },
): Promise<DataComemorativa> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "UPDATE dho_datas_comemorativas SET data = ?, nome = ?, categoria = ? WHERE id = ? RETURNING id, data, nome, categoria",
    args: [dados.data, dados.nome, dados.categoria, id],
  });
  return (resultado.rows as unknown as LinhaDataComemorativa[])[0];
}

export async function excluirDataComemorativa(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM dho_datas_comemorativas WHERE id = ?", args: [id] });
}

export interface LinhaOrcamentoMes {
  mes: number;
  aprovado: number;
  utilizado: number;
  gap: number;
  saving: number;
}

/** Aprovado vem digitado (dho_orcamento_mensal); Utilizado é sempre a soma dos itens das ações daquele mês — nunca fica salvo solto. */
export async function obterOrcamentoAnual(ano: number): Promise<LinhaOrcamentoMes[]> {
  const db = await getDb();
  const aprovados = await db.execute({
    sql: "SELECT mes, aprovado FROM dho_orcamento_mensal WHERE ano = ?",
    args: [ano],
  });
  const mapaAprovado = new Map((aprovados.rows as unknown as { mes: number; aprovado: number }[]).map((r) => [r.mes, r.aprovado]));

  const utilizados = await db.execute({
    sql: `SELECT CAST(substring(e.data from 6 for 2) AS integer) AS mes, COALESCE(SUM(i.quantidade * i.valor_unitario), 0) AS utilizado
          FROM dho_eventos_calendario e JOIN dho_evento_itens i ON i.evento_id = e.id
          WHERE e.data LIKE ? GROUP BY 1`,
    args: [`${ano}-%`],
  });
  const mapaUtilizado = new Map((utilizados.rows as unknown as { mes: number; utilizado: number }[]).map((r) => [r.mes, r.utilizado]));

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const aprovado = mapaAprovado.get(mes) ?? 0;
    const utilizado = mapaUtilizado.get(mes) ?? 0;
    const gap = aprovado - utilizado;
    return { mes, aprovado, utilizado, gap, saving: Math.max(gap, 0) };
  });
}

export async function definirOrcamentoMensal(ano: number, mes: number, aprovado: number): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO dho_orcamento_mensal (ano, mes, aprovado) VALUES (?, ?, ?)
          ON CONFLICT (ano, mes) DO UPDATE SET aprovado = EXCLUDED.aprovado`,
    args: [ano, mes, aprovado],
  });
}

export interface MaterialKit {
  id: number;
  nome: string;
  valor: number;
  quantidadeEstoque: number;
}

export interface ResumoKit {
  id: number;
  nome: string;
  /** Custo de montar um kit completo — soma do valor de cada material. */
  valor: number;
  /** Quantos kits completos dá pra montar com o estoque atual (o item mais escasso manda). */
  quantidadeEstoque: number;
}

interface LinhaMaterial {
  id: number;
  kit_id: number;
  nome: string;
  valor: number;
  quantidade_estoque: number;
}

function paraMaterial(l: LinhaMaterial): MaterialKit {
  return { id: l.id, nome: l.nome, valor: l.valor, quantidadeEstoque: l.quantidade_estoque };
}

export async function listarKits(): Promise<ResumoKit[]> {
  const db = await getDb();
  const kits = await db.execute("SELECT id, nome FROM dho_kits ORDER BY id");
  const materiais = await db.execute(
    "SELECT id, kit_id, nome, valor, quantidade_estoque FROM dho_kit_materiais ORDER BY id",
  );
  const linhasMateriais = materiais.rows as unknown as LinhaMaterial[];

  return (kits.rows as unknown as { id: number; nome: string }[]).map((k) => {
    const doKit = linhasMateriais.filter((m) => m.kit_id === k.id);
    return {
      id: k.id,
      nome: k.nome,
      valor: doKit.reduce((s, m) => s + m.valor, 0),
      quantidadeEstoque: doKit.length > 0 ? Math.min(...doKit.map((m) => m.quantidade_estoque)) : 0,
    };
  });
}

export interface EntregaKit {
  id: number;
  colaboradorId: number;
  colaboradorNome: string;
  colaboradorCargo: string | null;
  colaboradorDepartamento: string | null;
  materiais: string[];
  responsavel: string;
  criadoEm: string;
}

export interface DetalheKit {
  id: number;
  nome: string;
  materiais: MaterialKit[];
  historico: EntregaKit[];
}

export async function obterKit(kitId: number): Promise<DetalheKit | null> {
  const db = await getDb();
  const kit = await db.execute({ sql: "SELECT id, nome FROM dho_kits WHERE id = ?", args: [kitId] });
  const linhaKit = (kit.rows as unknown as { id: number; nome: string }[])[0];
  if (!linhaKit) return null;

  const materiais = await db.execute({
    sql: "SELECT id, kit_id, nome, valor, quantidade_estoque FROM dho_kit_materiais WHERE kit_id = ? ORDER BY id",
    args: [kitId],
  });

  const entregas = await db.execute({
    sql: `SELECT e.id, e.colaborador_id, c.nome AS colaborador_nome, c.cargo AS colaborador_cargo,
                 c.departamento AS colaborador_departamento, e.materiais, e.responsavel, e.criado_em
          FROM dho_kit_entregas e JOIN colaboradores c ON c.id = e.colaborador_id
          WHERE e.kit_id = ? ORDER BY e.criado_em DESC`,
    args: [kitId],
  });

  return {
    id: linhaKit.id,
    nome: linhaKit.nome,
    materiais: (materiais.rows as unknown as LinhaMaterial[]).map(paraMaterial),
    historico: (
      entregas.rows as unknown as {
        id: number;
        colaborador_id: number;
        colaborador_nome: string;
        colaborador_cargo: string | null;
        colaborador_departamento: string | null;
        materiais: string;
        responsavel: string;
        criado_em: string;
      }[]
    ).map((e) => ({
      id: e.id,
      colaboradorId: e.colaborador_id,
      colaboradorNome: e.colaborador_nome,
      colaboradorCargo: e.colaborador_cargo,
      colaboradorDepartamento: e.colaborador_departamento,
      materiais: JSON.parse(e.materiais) as string[],
      responsavel: e.responsavel,
      criadoEm: e.criado_em,
    })),
  };
}

export async function atualizarMaterialKit(materialId: number, dados: { valor: number; quantidadeEstoque: number }): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE dho_kit_materiais SET valor = ?, quantidade_estoque = ? WHERE id = ?",
    args: [dados.valor, dados.quantidadeEstoque, materialId],
  });
}

/** Direciona um kit (um material ou todos) a um colaborador — abate do estoque e registra no histórico. */
export async function enviarKit(dados: {
  kitId: number;
  colaboradorId: number;
  materiaisIds: number[];
  responsavel: string;
}): Promise<void> {
  const db = await getDb();
  const materiais = await db.execute({
    sql: "SELECT id, nome FROM dho_kit_materiais WHERE kit_id = ? AND id = ANY(?::int[])",
    args: [dados.kitId, dados.materiaisIds],
  });
  const linhas = materiais.rows as unknown as { id: number; nome: string }[];
  if (linhas.length === 0) throw new Error("Selecione ao menos um material.");

  await db.batch([
    ...linhas.map((m) => ({
      sql: "UPDATE dho_kit_materiais SET quantidade_estoque = GREATEST(0, quantidade_estoque - 1) WHERE id = ?",
      args: [m.id],
    })),
    {
      sql: "INSERT INTO dho_kit_entregas (kit_id, colaborador_id, materiais, responsavel) VALUES (?, ?, ?, ?)",
      args: [dados.kitId, dados.colaboradorId, JSON.stringify(linhas.map((m) => m.nome)), dados.responsavel],
    },
  ]);
}

/** Apaga um registro do histórico e devolve ao estoque os materiais daquela entrega — desfaz por completo, não só o registro. */
export async function excluirEntregaKit(entregaId: number): Promise<void> {
  const db = await getDb();
  const entrega = await db.execute({ sql: "SELECT kit_id, materiais FROM dho_kit_entregas WHERE id = ?", args: [entregaId] });
  const linha = (entrega.rows as unknown as { kit_id: number; materiais: string }[])[0];
  if (!linha) return;
  const nomes = JSON.parse(linha.materiais) as string[];

  await db.batch([
    ...nomes.map((nome) => ({
      sql: "UPDATE dho_kit_materiais SET quantidade_estoque = quantidade_estoque + 1 WHERE kit_id = ? AND nome = ?",
      args: [linha.kit_id, nome],
    })),
    { sql: "DELETE FROM dho_kit_entregas WHERE id = ?", args: [entregaId] },
  ]);
}
