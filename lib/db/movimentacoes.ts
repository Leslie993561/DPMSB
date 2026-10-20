import "server-only";
import { listarColaboradores } from "./colaboradores";
import { getDb } from "./client";
import type { TipoMovimento } from "@/lib/folha/movimentacoesTipos";

export interface MovimentoColaborador {
  colaboradorId: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  /** Data da admissão (entrada) ou do desligamento (saída), "AAAA-MM-DD". */
  data: string;
  movimento: TipoMovimento;
  /** Tipo escolhido pelo RH (ex.: "Aumento de quadro", "Substituição"); null = ainda não classificado. */
  tipo: string | null;
  /** Justificativa escrita pelo RH; nas saídas, sem texto próprio, vale o motivo do desligamento. */
  justificativa: string | null;
}

export interface MesMovimentacao {
  /** 1–12. */
  mes: number;
  entradas: MovimentoColaborador[];
  saidas: MovimentoColaborador[];
}

export interface HistoricoMovimentacoes {
  ano: number;
  /** Anos com ao menos uma admissão ou desligamento, para o seletor da tela. */
  anos: number[];
  meses: MesMovimentacao[];
  /** Colaboradores ativos hoje no Quadro (o número principal da tela). */
  ativosAtuais: number;
  /** Só quem está em ehEmailEditorMovimentacoes classifica as movimentações. */
  podeEditar: boolean;
}

function anoMes(dataIso: string | null): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec((dataIso ?? "").trim());
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano: Number(m[1]), mes } : null;
}

/**
 * Quem entrou (data de admissão) e quem saiu (data de desligamento) em cada mês
 * do ano, a partir do cadastro de colaboradores — a mesma base do Quadro, então
 * o histórico nunca diverge dele. Colaborador admitido e desligado no mesmo ano
 * aparece nas duas colunas, cada uma no seu mês.
 */
export async function obterHistoricoMovimentacoes(ano: number, podeEditar: boolean): Promise<HistoricoMovimentacoes> {
  const colaboradores = await listarColaboradores();
  const db = await getDb();
  const infos = (await db.execute("SELECT colaborador_id, movimento, tipo, justificativa FROM movimentacoes_info"))
    .rows as unknown as { colaborador_id: number; movimento: TipoMovimento; tipo: string | null; justificativa: string | null }[];
  const infoPorChave = new Map(infos.map((i) => [`${i.colaborador_id}:${i.movimento}`, i]));
  const meses: MesMovimentacao[] = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, entradas: [], saidas: [] }));
  const anos = new Set<number>([ano]);

  const base = (c: (typeof colaboradores)[number], data: string, movimento: TipoMovimento): MovimentoColaborador => {
    const info = infoPorChave.get(`${c.id}:${movimento}`);
    return {
      colaboradorId: c.id,
      nome: c.nome,
      cargo: c.cargo,
      departamento: c.departamento,
      vinculo: c.vinculo,
      data,
      movimento,
      // Saída: tipo e motivo vêm do desligamento feito no Quadro de Colaboradores.
      tipo: movimento === "saida" ? c.tipoDesligamento : (info?.tipo ?? null),
      justificativa: movimento === "saida" ? c.motivoDesligamento : (info?.justificativa ?? null),
    };
  };

  for (const c of colaboradores) {
    const entrada = anoMes(c.dataAdmissao);
    if (entrada) {
      anos.add(entrada.ano);
      if (entrada.ano === ano) meses[entrada.mes - 1].entradas.push(base(c, c.dataAdmissao, "entrada"));
    }
    const saida = anoMes(c.dataDesligamento);
    if (saida && c.dataDesligamento) {
      anos.add(saida.ano);
      if (saida.ano === ano) meses[saida.mes - 1].saidas.push(base(c, c.dataDesligamento, "saida"));
    }
  }

  const porDataENome = (a: MovimentoColaborador, b: MovimentoColaborador) =>
    a.data.localeCompare(b.data) || a.nome.localeCompare(b.nome, "pt-BR");
  for (const m of meses) {
    m.entradas.sort(porDataENome);
    m.saidas.sort(porDataENome);
  }

  const ativosAtuais = colaboradores.filter((c) => c.status === "ativo").length;
  return { ano, anos: [...anos].sort((a, b) => b - a), meses, ativosAtuais, podeEditar };
}

/**
 * Grava o tipo e a justificativa de uma entrada (tabela própria) ou de uma saída
 * (colunas do desligamento no colaborador — mesma fonte do Quadro). Vazio vira null.
 */
export async function salvarInfoMovimentacao(dados: {
  colaboradorId: number;
  movimento: TipoMovimento;
  tipo: string | null;
  justificativa: string | null;
}): Promise<void> {
  const db = await getDb();
  if (dados.movimento === "saida") {
    await db.execute({
      sql: "UPDATE colaboradores SET tipo_desligamento = ?, motivo_desligamento = ? WHERE id = ?",
      args: [dados.tipo, dados.justificativa, dados.colaboradorId],
    });
    return;
  }
  await db.execute({
    sql: `INSERT INTO movimentacoes_info (colaborador_id, movimento, tipo, justificativa) VALUES (?, ?, ?, ?)
         ON CONFLICT (colaborador_id, movimento) DO UPDATE SET tipo = EXCLUDED.tipo, justificativa = EXCLUDED.justificativa`,
    args: [dados.colaboradorId, dados.movimento, dados.tipo, dados.justificativa],
  });
}
