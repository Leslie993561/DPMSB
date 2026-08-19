import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { calcularFerias, calcularFGTS, calcularInssPatronal, avaliarPrazoConcessao, arredondar } from "@/lib/calc";
import type { StatusLancamento } from "./lancamentosFerias";

export interface DetalheCalculoFerias {
  salarioBase: number;
  valorDiario: number;
  valorGozado: number;
  tercoConstitucional: number;
  abono: number;
  tercoAbono: number;
  bruto: number;
  inss: number;
  irrf: number;
  liquido: number;
  fgts: number;
  inssPatronal: number;
}

export interface ItemProgramacaoFerias {
  lancamentoId: number;
  periodoAquisitivoId: number;
  colaboradorId: number;
  colaboradorNome: string;
  colaboradorCargo: string | null;
  colaboradorDepartamento: string | null;
  colaboradorAdmissao: string;
  liderNome: string | null;
  aquisitivoInicio: string;
  aquisitivoFim: string;
  concessivoInicio: string;
  concessivoFim: string;
  diasDireito: number;
  status: StatusLancamento;
  dias: number;
  abono: boolean;
  diasAbono: number;
  dataInicio: string;
  dataRetorno: string | null;
  trimestre: 1 | 2 | 3 | 4;
  ano: number;
  custoPrevisto: number;
  semSalario: boolean;
  vencida: boolean;
  diasParaVencer: number;
  detalhe: DetalheCalculoFerias;
}

interface LinhaProgramacao {
  id: number;
  status: StatusLancamento;
  dias: number;
  abono: number;
  dias_abono: number;
  data_inicio_prevista: string | null;
  data_inicio_gozo: string | null;
  data_retorno: string | null;
  periodo_aquisitivo_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  dias_direito: number;
  colaborador_id: number;
}

/**
 * Toda a "Programação Anual" de férias — um item por lançamento ativo (não
 * cancelado), com o contexto completo do colaborador e do período para
 * exibir a tabela do Planejamento e agrupar por trimestre/ano.
 *
 * Ao contrário de `listarPeriodosAbertos()` (Controle de Férias, que só
 * mostra o período em aberto mais recente por colaborador), aqui cada
 * LANÇAMENTO é sua própria linha — uma vez "baixado" (confirmado), ele
 * continua aparecendo no mesmo trimestre, só muda de status. É assim que o
 * Planejamento preserva o histórico do trimestre em vez de fazer a linha
 * desaparecer.
 */
export async function listarProgramacaoFerias(): Promise<ItemProgramacaoFerias[]> {
  const colaboradores = await listarColaboradores();
  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));

  const db = await getDb();
  const resultado = await db.execute(
    `SELECT l.id, l.status, l.dias, l.abono, l.dias_abono,
              l.data_inicio_prevista, l.data_inicio_gozo, l.data_retorno,
              p.id AS periodo_aquisitivo_id, p.data_inicio AS periodo_inicio, p.data_fim AS periodo_fim,
              p.dias_direito, p.colaborador_id
       FROM lancamentos_ferias l
       JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
       WHERE l.status != 'cancelada'`,
  );
  const linhas = resultado.rows as unknown as LinhaProgramacao[];

  const itens: ItemProgramacaoFerias[] = [];

  for (const linha of linhas) {
    const colaborador = colaboradoresPorId.get(linha.colaborador_id);
    if (!colaborador) continue;

    const dataInicio = linha.data_inicio_gozo ?? linha.data_inicio_prevista;
    if (!dataInicio) continue;

    const dataRef = new Date(dataInicio);
    const semSalario = !colaborador.salarioBase || colaborador.salarioBase <= 0;

    const resultado = calcularFerias({
      salarioBase: colaborador.salarioBase,
      diasDireito: linha.dias_direito,
      diasGozados: linha.dias,
      abonoPecuniario: Boolean(linha.abono),
      dependentes: colaborador.dependentes,
      competencia: dataRef,
    });
    const bruto = arredondar(
      resultado.detalhe.valorGozado +
        resultado.detalhe.tercoConstitucional +
        resultado.detalhe.abono +
        resultado.detalhe.tercoAbono,
    );
    const fgts = calcularFGTS(bruto, dataRef).valor;
    const patronal = calcularInssPatronal(bruto, dataRef).valor;
    const custoPrevisto = arredondar(bruto + fgts + patronal);

    const prazo = avaliarPrazoConcessao(new Date(linha.periodo_fim), dataRef);
    const hoje = new Date();
    const limiteConcessao = new Date(prazo.limiteConcessao);
    const diasParaVencer = Math.round((limiteConcessao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    const lider = colaborador.gestorId ? (colaboradoresPorId.get(colaborador.gestorId)?.nome ?? null) : null;

    itens.push({
      lancamentoId: linha.id,
      periodoAquisitivoId: linha.periodo_aquisitivo_id,
      colaboradorId: colaborador.id,
      colaboradorNome: colaborador.nome,
      colaboradorCargo: colaborador.cargo,
      colaboradorDepartamento: colaborador.departamento,
      colaboradorAdmissao: colaborador.dataAdmissao,
      liderNome: lider,
      aquisitivoInicio: linha.periodo_inicio,
      aquisitivoFim: linha.periodo_fim,
      concessivoInicio: linha.periodo_fim,
      concessivoFim: prazo.limiteConcessao,
      diasDireito: linha.dias_direito,
      status: linha.status,
      dias: linha.dias,
      abono: Boolean(linha.abono),
      diasAbono: linha.dias_abono,
      dataInicio,
      dataRetorno: linha.data_retorno,
      trimestre: Math.ceil((dataRef.getMonth() + 1) / 3) as 1 | 2 | 3 | 4,
      ano: dataRef.getFullYear(),
      custoPrevisto,
      semSalario,
      vencida: prazo.vencida,
      diasParaVencer,
      detalhe: {
        salarioBase: colaborador.salarioBase,
        valorDiario: arredondar(colaborador.salarioBase / 30),
        valorGozado: resultado.detalhe.valorGozado,
        tercoConstitucional: resultado.detalhe.tercoConstitucional,
        abono: resultado.detalhe.abono,
        tercoAbono: resultado.detalhe.tercoAbono,
        bruto,
        inss: resultado.detalhe.inss,
        irrf: resultado.detalhe.irrf,
        liquido: resultado.detalhe.valorLiquido,
        fgts,
        inssPatronal: patronal,
      },
    });
  }

  return itens.sort((a, z) => a.dataInicio.localeCompare(z.dataInicio));
}
