import "server-only";
import { randomUUID } from "node:crypto";
import { sstQuery } from "./db";
import {
  computeProgramaStatus,
  diasRestantesPrograma,
  versoesMaisRecentes,
  PROGRAMAS_SAUDE,
  type PrecisaoData,
  type StatusPrograma,
  type ProgramaSaude,
} from "./domain";

interface LinhaProgramaSaude {
  id: string;
  programa: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  precisao_fim: PrecisaoData;
  autor: string;
  anexo_url: string | null;
  anexo_nome: string | null;
  ts: string;
}

export interface VersaoProgramaSaude {
  id: string;
  programa: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  precisaoFim: PrecisaoData;
  autor: string;
  anexoNome: string | null;
  ts: string;
  status: StatusPrograma;
  diasRestantes: number | null;
}

/** Última versão carregada de cada programa (PCMSO/LTCAT/PGR) — null para o que nunca foi cadastrado. */
export async function listarProgramasSaude(): Promise<Record<ProgramaSaude, VersaoProgramaSaude | null>> {
  const linhas = await sstQuery<LinhaProgramaSaude>(
    "SELECT id, programa, vigencia_inicio, vigencia_fim, precisao_fim, autor, anexo_url, anexo_nome, ts FROM sst_programas_saude ORDER BY ts DESC",
  );
  const recentes = versoesMaisRecentes(
    linhas.map((l) => ({ programa: l.programa, vigenciaFim: l.vigencia_fim, precisaoFim: l.precisao_fim, ts: l.ts, linha: l })),
  );
  const porPrograma = new Map(recentes.map((r) => [r.programa, r.linha]));

  const resultado = {} as Record<ProgramaSaude, VersaoProgramaSaude | null>;
  for (const programa of PROGRAMAS_SAUDE) {
    const l = porPrograma.get(programa);
    resultado[programa] = l
      ? {
          id: l.id,
          programa: l.programa,
          vigenciaInicio: l.vigencia_inicio,
          vigenciaFim: l.vigencia_fim,
          precisaoFim: l.precisao_fim,
          autor: l.autor,
          anexoNome: l.anexo_nome,
          ts: l.ts,
          status: computeProgramaStatus(l.vigencia_fim, l.precisao_fim),
          diasRestantes: diasRestantesPrograma(l.vigencia_fim, l.precisao_fim),
        }
      : null;
  }
  return resultado;
}

export interface NovaVersaoPrograma {
  programa: ProgramaSaude;
  vigenciaInicio: string;
  vigenciaFim: string;
  precisaoFim: PrecisaoData;
  autor: string;
  anexoUrl?: string | null;
  anexoNome?: string | null;
}

/** Registra uma nova versão do programa — não apaga as anteriores, só passam a não ser mais "a vigente". */
export async function registrarVersaoPrograma(nova: NovaVersaoPrograma): Promise<{ id: string }> {
  const id = randomUUID();
  await sstQuery(
    `INSERT INTO sst_programas_saude (id, programa, vigencia_inicio, vigencia_fim, precisao_fim, autor, anexo_url, anexo_nome, ts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      nova.programa,
      nova.vigenciaInicio,
      nova.vigenciaFim,
      nova.precisaoFim,
      nova.autor,
      nova.anexoUrl ?? null,
      nova.anexoNome ?? null,
      new Date().toISOString(),
    ],
  );
  return { id };
}

export async function obterAnexoProgramaSaude(id: string): Promise<{ url: string; nome: string | null } | null> {
  const [p] = await sstQuery<{ anexo_url: string | null; anexo_nome: string | null }>(
    "SELECT anexo_url, anexo_nome FROM sst_programas_saude WHERE id = $1",
    [id],
  );
  if (!p?.anexo_url) return null;
  return { url: p.anexo_url, nome: p.anexo_nome };
}
