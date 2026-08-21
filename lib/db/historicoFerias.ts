import "server-only";
import { getDb } from "./client";
import { avaliarPrazoConcessao } from "@/lib/calc";
import type { StatusLancamento } from "./lancamentosFerias";

export interface FeriasDoHistorico {
  lancamentoId: number;
  status: StatusLancamento;
  dias: number;
  diasAbono: number;
  /** Datas reais de gozo quando existem; senão, a data prevista da programação. */
  inicio: string | null;
  fim: string | null;
  abonoInicio: string | null;
  abonoFim: string | null;
  observacao: string | null;
}

export interface PeriodoDoHistorico {
  periodoId: number;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  /** Período concessivo: os 12 meses seguintes ao fim do aquisitivo, quando as férias têm de ser concedidas. */
  concessivoInicio: string;
  concessivoFim: string;
  diasDireito: number;
  status: string;
  diasGozados: number;
  diasRestantes: number;
  ferias: FeriasDoHistorico[];
}

interface LinhaHistorico {
  periodo_id: number;
  data_inicio: string;
  data_fim: string;
  dias_direito: number;
  periodo_status: string;
  lancamento_id: number | null;
  lancamento_status: StatusLancamento | null;
  dias: number | null;
  dias_abono: number | null;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
  data_inicio_prevista: string | null;
  abono_inicio: string | null;
  abono_fim: string | null;
  observacao: string | null;
}

/**
 * Histórico de férias do colaborador — todos os períodos aquisitivos, cada um
 * com os lançamentos dentro dele, numa query só (evita uma ida ao banco por
 * período). Traz também o período concessivo calculado, que não é armazenado:
 * é sempre derivado do fim do aquisitivo pelo mesmo motor de `lib/calc`.
 */
export async function listarHistoricoFerias(colaboradorId: number): Promise<PeriodoDoHistorico[]> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `SELECT p.id AS periodo_id, p.data_inicio, p.data_fim, p.dias_direito, p.status AS periodo_status,
                 l.id AS lancamento_id, l.status AS lancamento_status, l.dias, l.dias_abono,
                 l.data_inicio_gozo, l.data_fim_gozo, l.data_inicio_prevista,
                 l.abono_inicio, l.abono_fim, l.observacao
            FROM periodos_aquisitivos p
            LEFT JOIN lancamentos_ferias l ON l.periodo_aquisitivo_id = p.id
           WHERE p.colaborador_id = ?
           ORDER BY p.data_inicio DESC, l.data_inicio_gozo, l.id`,
    args: [colaboradorId],
  });

  const porPeriodo = new Map<number, PeriodoDoHistorico>();
  for (const l of resultado.rows as unknown as LinhaHistorico[]) {
    let periodo = porPeriodo.get(l.periodo_id);
    if (!periodo) {
      const prazo = avaliarPrazoConcessao(new Date(l.data_fim), new Date());
      periodo = {
        periodoId: l.periodo_id,
        aquisitivoInicio: l.data_inicio,
        aquisitivoFim: l.data_fim,
        concessivoInicio: l.data_fim,
        concessivoFim: prazo.limiteConcessao,
        diasDireito: l.dias_direito,
        status: l.periodo_status,
        diasGozados: 0,
        diasRestantes: l.dias_direito,
        ferias: [],
      };
      porPeriodo.set(l.periodo_id, periodo);
    }

    if (l.lancamento_id === null || l.lancamento_status === "cancelada") continue;

    periodo.ferias.push({
      lancamentoId: l.lancamento_id,
      status: l.lancamento_status!,
      dias: l.dias ?? 0,
      diasAbono: l.dias_abono ?? 0,
      inicio: l.data_inicio_gozo ?? l.data_inicio_prevista,
      fim: l.data_fim_gozo,
      abonoInicio: l.abono_inicio,
      abonoFim: l.abono_fim,
      observacao: l.observacao,
    });

    // Só férias confirmadas contam como gozadas — programação ainda não
    // confirmada reserva a data, mas não consome saldo.
    if (l.lancamento_status === "concluida" || l.lancamento_status === "alterada") {
      periodo.diasGozados += l.dias ?? 0;
      periodo.diasRestantes = periodo.diasDireito - periodo.diasGozados;
    }
  }

  return Array.from(porPeriodo.values());
}
