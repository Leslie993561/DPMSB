import "server-only";
import { getDb } from "./client";
import { listarColaboradores, type Colaborador } from "./colaboradores";
import { criarLancamentoPj, ErroValidacaoFerias } from "./lancamentosFerias";
import {
  alocarDiasPj,
  periodosAquisitivosCompletos,
  saldosPorPeriodo,
  saldoTotalPj,
  valorFeriasPj,
  type SaldoPeriodoPj,
} from "@/lib/ferias-pj/calc";

export interface LancamentoPj {
  id: number;
  dias: number;
  dataInicio: string | null;
  dataFim: string | null;
  valor: number;
}

export interface ControleFeriasPj {
  colaboradorId: number;
  colaboradorNome: string;
  colaboradorCargo: string | null;
  colaboradorDepartamento: string | null;
  colaboradorCpf: string | null;
  colaboradorAdmissao: string;
  /** Valor mensal do contrato (`salarioBase` do cadastro). */
  valorMensal: number;
  periodos: SaldoPeriodoPj[];
  diasGozados: number;
  saldoTotal: number;
  lancamentos: LancamentoPj[];
}

export function ehPj(colaborador: Pick<Colaborador, "vinculo">): boolean {
  return colaborador.vinculo === "PJ";
}

interface LinhaGozo {
  id: number;
  colaborador_id: number;
  dias: number;
  data_inicio_gozo: string | null;
  data_fim_gozo: string | null;
}

/** Só férias efetivamente gozadas (concluída/alterada) abatem o saldo — programação futura só reserva data. */
async function gozosPorColaborador(): Promise<Map<number, LinhaGozo[]>> {
  const db = await getDb();
  const resultado = await db.execute(
    `SELECT l.id, p.colaborador_id, l.dias, l.data_inicio_gozo, l.data_fim_gozo
       FROM lancamentos_ferias l
       JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
       JOIN colaboradores c ON c.id = p.colaborador_id
      WHERE c.vinculo = 'PJ' AND l.status IN ('concluida','alterada')
      ORDER BY l.data_inicio_gozo, l.id`,
  );
  const mapa = new Map<number, LinhaGozo[]>();
  for (const l of resultado.rows as unknown as LinhaGozo[]) {
    const lista = mapa.get(l.colaborador_id) ?? [];
    lista.push(l);
    mapa.set(l.colaborador_id, lista);
  }
  return mapa;
}

function montarControle(colaborador: Colaborador, gozos: LinhaGozo[], hoje: Date): ControleFeriasPj {
  const completos = periodosAquisitivosCompletos(colaborador.dataAdmissao, hoje);
  const diasGozados = gozos.reduce((s, g) => s + g.dias, 0);
  return {
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    colaboradorCargo: colaborador.cargo,
    colaboradorDepartamento: colaborador.departamento,
    colaboradorCpf: colaborador.cpf,
    colaboradorAdmissao: colaborador.dataAdmissao,
    valorMensal: colaborador.salarioBase,
    periodos: saldosPorPeriodo(completos, diasGozados),
    diasGozados,
    saldoTotal: saldoTotalPj(completos, diasGozados),
    lancamentos: gozos.map((g) => ({
      id: g.id,
      dias: g.dias,
      dataInicio: g.data_inicio_gozo,
      dataFim: g.data_fim_gozo,
      valor: valorFeriasPj(colaborador.salarioBase, g.dias),
    })),
  };
}

/** Um registro por colaborador PJ ativo — as linhas "PJ" da tabela do Controle de Férias. */
export async function listarControlePj(colaboradores?: Colaborador[]): Promise<ControleFeriasPj[]> {
  const hoje = new Date();
  const todos = colaboradores ?? (await listarColaboradores());
  const pjs = todos.filter((c) => ehPj(c) && c.status !== "desligado");
  if (pjs.length === 0) return [];
  const gozos = await gozosPorColaborador();
  return pjs.map((c) => montarControle(c, gozos.get(c.id) ?? [], hoje));
}

export interface LancarFeriasPjInput {
  colaboradorId: number;
  dias: number;
  dataInicioGozo: string;
  dataFimGozo: string;
  observacao: string | null;
  operador: string;
}

/**
 * Lança férias de PJ em qualquer quantidade de dias, desde que caibam no saldo.
 * O abatimento é do período aquisitivo mais antigo para o mais novo; um pedido
 * que atravessa dois períodos vira um lançamento por período.
 */
export async function lancarFeriasPj(input: LancarFeriasPjInput): Promise<ControleFeriasPj> {
  const colaborador = (await listarColaboradores()).find((c) => c.id === input.colaboradorId);
  if (!colaborador) throw new ErroValidacaoFerias("Colaborador não encontrado.");
  if (!ehPj(colaborador)) throw new ErroValidacaoFerias("Este colaborador não tem vínculo PJ.");
  if (!input.dataInicioGozo || !input.dataFimGozo || input.dataFimGozo < input.dataInicioGozo) {
    throw new ErroValidacaoFerias("Informe o início e o fim do gozo (o fim não pode ser anterior ao início).");
  }

  const hoje = new Date();
  const gozos = (await gozosPorColaborador()).get(colaborador.id) ?? [];
  const completos = periodosAquisitivosCompletos(colaborador.dataAdmissao, hoje);
  const saldos = saldosPorPeriodo(
    completos,
    gozos.reduce((s, g) => s + g.dias, 0),
  );
  const total = saldos.reduce((s, p) => s + p.saldo, 0);
  const partes = alocarDiasPj(saldos, input.dias);
  if (!partes) {
    throw new ErroValidacaoFerias(
      Number.isInteger(input.dias) && input.dias > 0
        ? `Saldo insuficiente: ${input.dias} dias solicitados, ${total} disponíveis.`
        : "Informe uma quantidade de dias inteira e maior que zero.",
    );
  }

  // Os períodos precisam existir no banco para receber o lançamento (FK); são
  // criados só agora, na hora de gastar — a leitura do Controle não grava nada.
  const db = await getDb();
  const ids: number[] = [];
  for (const p of completos) {
    await db.execute({
      sql: `INSERT INTO periodos_aquisitivos (colaborador_id, data_inicio, data_fim, dias_direito)
            VALUES (?, ?, ?, 30) ON CONFLICT (colaborador_id, data_inicio) DO NOTHING`,
      args: [colaborador.id, p.inicio, p.fim],
    });
    const r = await db.execute({
      sql: "SELECT id FROM periodos_aquisitivos WHERE colaborador_id = ? AND data_inicio = ?",
      args: [colaborador.id, p.inicio],
    });
    ids.push(Number((r.rows[0] as unknown as { id: number }).id));
  }

  for (const parte of partes) {
    await criarLancamentoPj({
      periodoAquisitivoId: ids[parte.indice],
      dias: parte.dias,
      dataInicioGozo: input.dataInicioGozo,
      dataFimGozo: input.dataFimGozo,
      observacao: input.observacao,
      operador: input.operador,
    });
  }

  const atualizados = await gozosPorColaborador();
  return montarControle(colaborador, atualizados.get(colaborador.id) ?? [], hoje);
}
