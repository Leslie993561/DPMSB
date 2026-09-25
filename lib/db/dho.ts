import "server-only";
import { getDb } from "./client";

export interface EventoCalendario {
  id: number;
  data: string;
  titulo: string;
}

export async function listarEventosCalendario(ano: number): Promise<EventoCalendario[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT id, data, titulo FROM dho_eventos_calendario WHERE data LIKE ? ORDER BY data",
    args: [`${ano}-%`],
  });
  return resultado.rows as unknown as EventoCalendario[];
}

export async function criarEventoCalendario(data: string, titulo: string): Promise<EventoCalendario> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "INSERT INTO dho_eventos_calendario (data, titulo) VALUES (?, ?) RETURNING id, data, titulo",
    args: [data, titulo],
  });
  return (resultado.rows as unknown as EventoCalendario[])[0];
}

export async function excluirEventoCalendario(id: number): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM dho_eventos_calendario WHERE id = ?", args: [id] });
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
