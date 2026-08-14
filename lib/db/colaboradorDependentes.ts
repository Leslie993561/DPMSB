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

export function listarDependentes(colaboradorId: number): ColaboradorDependente[] {
  const linhas = getDb()
    .prepare("SELECT * FROM colaborador_dependentes WHERE colaborador_id = ? ORDER BY id")
    .all(colaboradorId) as unknown as LinhaDependente[];
  return linhas.map(paraDependente);
}

/**
 * Substitui todos os dependentes cadastrados do colaborador pela lista informada.
 * O formulário sempre envia a lista completa (não deltas), então apagar e recriar
 * é mais simples e correto do que tentar casar itens existentes com editados.
 */
export function substituirDependentes(colaboradorId: number, itens: ColaboradorDependenteInput[]): void {
  const db = getDb();
  db.prepare("DELETE FROM colaborador_dependentes WHERE colaborador_id = ?").run(colaboradorId);
  const inserir = db.prepare(
    `INSERT INTO colaborador_dependentes
       (colaborador_id, nome, cpf, sexo, data_nascimento, certidao_livro, certidao_folha, certidao_matricula, certidao_data_emissao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of itens) {
    inserir.run(
      colaboradorId,
      item.nome,
      item.cpf ?? null,
      item.sexo ?? null,
      item.dataNascimento ?? null,
      item.certidaoLivro ?? null,
      item.certidaoFolha ?? null,
      item.certidaoMatricula ?? null,
      item.certidaoDataEmissao ?? null,
    );
  }
}
