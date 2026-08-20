import "server-only";
import { getDb } from "./client";

export type SexoDependente = "M" | "F";

export interface ColaboradorDependente {
  id: number;
  colaboradorId: number;
  nome: string;
  cpf: string | null;
  sexo: SexoDependente | null;
  dataNascimento: string | null;
  certidaoLivro: string | null;
  certidaoFolha: string | null;
  certidaoMatricula: string | null;
  certidaoDataEmissao: string | null;
}

export interface ColaboradorDependenteInput {
  nome: string;
  cpf?: string | null;
  sexo?: SexoDependente | null;
  dataNascimento?: string | null;
  certidaoLivro?: string | null;
  certidaoFolha?: string | null;
  certidaoMatricula?: string | null;
  certidaoDataEmissao?: string | null;
}

interface LinhaDependente {
  id: number;
  colaborador_id: number;
  nome: string;
  cpf: string | null;
  sexo: SexoDependente | null;
  data_nascimento: string | null;
  certidao_livro: string | null;
  certidao_folha: string | null;
  certidao_matricula: string | null;
  certidao_data_emissao: string | null;
}

function paraDependente(linha: LinhaDependente): ColaboradorDependente {
  return {
    id: linha.id,
    colaboradorId: linha.colaborador_id,
    nome: linha.nome,
    cpf: linha.cpf,
    sexo: linha.sexo,
    dataNascimento: linha.data_nascimento,
    certidaoLivro: linha.certidao_livro,
    certidaoFolha: linha.certidao_folha,
    certidaoMatricula: linha.certidao_matricula,
    certidaoDataEmissao: linha.certidao_data_emissao,
  };
}

export async function listarDependentes(colaboradorId: number): Promise<ColaboradorDependente[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT * FROM colaborador_dependentes WHERE colaborador_id = ? ORDER BY id",
    args: [colaboradorId],
  });
  return (resultado.rows as unknown as LinhaDependente[]).map(paraDependente);
}

/**
 * Todos os dependentes de todos os colaboradores, agrupados por colaborador —
 * uma query só, para a exportação não pagar uma ida ao banco por colaborador.
 */
export async function listarDependentesPorColaborador(): Promise<Map<number, ColaboradorDependente[]>> {
  const db = await getDb();
  const resultado = await db.execute("SELECT * FROM colaborador_dependentes ORDER BY colaborador_id, id");
  const mapa = new Map<number, ColaboradorDependente[]>();
  for (const linha of resultado.rows as unknown as LinhaDependente[]) {
    const dependente = paraDependente(linha);
    const lista = mapa.get(dependente.colaboradorId) ?? [];
    lista.push(dependente);
    mapa.set(dependente.colaboradorId, lista);
  }
  return mapa;
}

/**
 * Substitui todos os dependentes cadastrados do colaborador pela lista informada.
 * O formulário sempre envia a lista completa (não deltas), então apagar e recriar
 * é mais simples e correto do que tentar casar itens existentes com editados.
 */
export async function substituirDependentes(
  colaboradorId: number,
  itens: ColaboradorDependenteInput[],
): Promise<void> {
  const db = await getDb();
  await db.batch(
    [
      { sql: "DELETE FROM colaborador_dependentes WHERE colaborador_id = ?", args: [colaboradorId] },
      ...itens.map((item) => ({
        sql: `INSERT INTO colaborador_dependentes
       (colaborador_id, nome, cpf, sexo, data_nascimento, certidao_livro, certidao_folha, certidao_matricula, certidao_data_emissao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          colaboradorId,
          item.nome,
          item.cpf ?? null,
          item.sexo ?? null,
          item.dataNascimento ?? null,
          item.certidaoLivro ?? null,
          item.certidaoFolha ?? null,
          item.certidaoMatricula ?? null,
          item.certidaoDataEmissao ?? null,
        ],
      })),
    ],
    "write",
  );
}
