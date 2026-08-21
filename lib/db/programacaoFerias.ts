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
  /** Acréscimo do Art. 137 CLT quando as férias saem fora do prazo; 0 quando no prazo. */
  dobra: number;
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
  /** Última data possível para iniciar estes dias de gozo ("Limite p/ gozo"). */
  limiteGozo: string;
  /** Dias deste lançamento que caem fora do concessivo e entram em dobro. */
  diasEmDobro: number;
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
  /** true quando a data das férias é anterior à tabela legal mais antiga — custo não apurável, não estimado. */
  semTabelaLegal: boolean;
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

    // Avaliado ANTES do cálculo: se as férias saem depois do fim do período
    // concessivo, a remuneração é paga em dobro (Art. 137 CLT) e isso muda o
    // valor. `vencida` aqui olha a data de início destas férias, não "hoje".
    const prazo = avaliarPrazoConcessao(new Date(linha.periodo_fim), dataRef, linha.dias);

    // Férias históricas (importadas da "Relação de Férias Calculadas") podem
    // ser anteriores à tabela legal mais antiga que o app tem — nesse caso
    // `calcularFerias` recusa, e com razão: sem a tabela do ano não há como
    // apurar INSS/IRRF. Como essas férias já foram pagas, o custo não precisa
    // ser recalculado; a linha entra sem valor, marcada com `semTabelaLegal`,
    // em vez de derrubar a listagem inteira. Nada é estimado.
    let calculo: ReturnType<typeof calcularFerias> | null = null;
    try {
      calculo = calcularFerias({
        salarioBase: colaborador.salarioBase,
        diasDireito: linha.dias_direito,
        diasGozados: linha.dias,
        abonoPecuniario: Boolean(linha.abono),
        dependentes: colaborador.dependentes,
        competencia: dataRef,
        diasEmDobro: prazo.diasEmDobro,
      });
    } catch {
      calculo = null;
    }
    const semTabelaLegal = calculo === null;

    // Base de encargos: a dobra fica fora (é penalidade, não contraprestação),
    // mas entra no custo total, que é o desembolso real da empresa.
    const bruto = calculo
      ? arredondar(
          calculo.detalhe.valorGozado +
            calculo.detalhe.tercoConstitucional +
            calculo.detalhe.abono +
            calculo.detalhe.tercoAbono,
        )
      : 0;
    const dobra = calculo?.detalhe.dobra ?? 0;
    const fgts = calculo ? calcularFGTS(bruto, dataRef).valor : 0;
    const patronal = calculo ? calcularInssPatronal(bruto, dataRef).valor : 0;
    const custoPrevisto = calculo ? arredondar(bruto + dobra + fgts + patronal) : 0;
    const resultado = calculo ?? {
      detalhe: {
        valorGozado: 0,
        tercoConstitucional: 0,
        abono: 0,
        tercoAbono: 0,
        dobra: 0,
        inss: 0,
        irrf: 0,
        valorLiquido: 0,
      },
    };

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
      limiteGozo: prazo.limiteInicio,
      diasEmDobro: prazo.diasEmDobro,
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
      semTabelaLegal,
      vencida: prazo.vencida,
      diasParaVencer,
      detalhe: {
        salarioBase: colaborador.salarioBase,
        valorDiario: arredondar(colaborador.salarioBase / 30),
        valorGozado: resultado.detalhe.valorGozado,
        tercoConstitucional: resultado.detalhe.tercoConstitucional,
        abono: resultado.detalhe.abono,
        tercoAbono: resultado.detalhe.tercoAbono,
        dobra,
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
