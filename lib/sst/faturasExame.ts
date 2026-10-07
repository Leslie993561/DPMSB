import "server-only";
import { randomUUID } from "node:crypto";
import { sstQuery } from "./db";
import type { AsoFatura, FaturaExames } from "./faturaExames";

export interface FaturaExameSalva {
  id: string;
  /** dd/mm/aaaa */
  fechamento: string;
  /** aaaa-mm */
  competencia: string;
  total: number;
  arquivoNome: string;
  asos: AsoFatura[];
}

interface Linha {
  id: string;
  fechamento: string;
  competencia: string;
  total: number;
  arquivo_nome: string;
  itens: AsoFatura[];
}

const SELECT = "SELECT id, fechamento, competencia, total::float8 AS total, arquivo_nome, itens FROM sst_faturas_exame";

function paraFatura(l: Linha): FaturaExameSalva {
  return { id: l.id, fechamento: l.fechamento, competencia: l.competencia, total: l.total, arquivoNome: l.arquivo_nome, asos: l.itens };
}

export async function listarFaturasExame(): Promise<FaturaExameSalva[]> {
  return (await sstQuery<Linha>(`${SELECT} ORDER BY competencia DESC`)).map(paraFatura);
}

/** Competência (aaaa-mm) a partir do fechamento dd/mm/aaaa. */
export function competenciaDoFechamento(fechamento: string): string {
  return `${fechamento.slice(6, 10)}-${fechamento.slice(3, 5)}`;
}

/** Grava a fatura do mês; reimportar o mesmo mês substitui a anterior. */
export async function salvarFaturaExame(fatura: FaturaExames, arquivoNome: string): Promise<{ substituiu: boolean }> {
  const competencia = competenciaDoFechamento(fatura.fechamento);
  const anterior = await sstQuery<{ id: string }>("SELECT id FROM sst_faturas_exame WHERE competencia = $1", [competencia]);
  await sstQuery(
    `INSERT INTO sst_faturas_exame (id, fechamento, competencia, total, arquivo_nome, itens)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (competencia) DO UPDATE
       SET fechamento = EXCLUDED.fechamento, total = EXCLUDED.total, arquivo_nome = EXCLUDED.arquivo_nome,
           itens = EXCLUDED.itens, created_at = now()`,
    [randomUUID(), fatura.fechamento, competencia, fatura.total, arquivoNome, JSON.stringify(fatura.asos)],
  );
  return { substituiu: anterior.length > 0 };
}

export async function excluirFaturaExame(id: string): Promise<boolean> {
  return (await sstQuery<{ id: string }>("DELETE FROM sst_faturas_exame WHERE id = $1 RETURNING id", [id])).length > 0;
}
