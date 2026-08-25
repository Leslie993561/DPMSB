import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { listarPeriodosAbertos } from "./periodosAquisitivos";
import { listarProgramacaoFerias, type ItemProgramacaoFerias } from "./programacaoFerias";
import { calcularFerias, calcularFGTS, calcularInssPatronal, arredondar } from "@/lib/calc";

export interface LinhaTrimestre {
  colaboradorNome: string;
  colaboradorDepartamento: string | null;
  aquisitivo: string;
  concessivo: string;
  dias: number;
  /** Férias + 1/3 (+ abono e dobra quando houver) — a remuneração das férias. */
  valorFerias: number;
  /** FGTS 8% + INSS patronal 20%. */
  encargos: number;
  /** valorFerias + encargos = o mesmo "custo previsto" que o Planejamento mostra na linha. */
  total: number;
}

export interface ResumoTrimestre {
  trimestre: 1 | 2 | 3 | 4;
  colaboradores: number;
  valorPago: number;
  encargos: number;
  linhas: LinhaTrimestre[];
}

export interface JaPago {
  valor: number;
  periodosPagos: number;
  /** "AAAA-MM" do primeiro e último mês com período concluído no ano — null se nenhum. */
  mesInicio: string | null;
  mesFim: string | null;
  percentualDoAnual: number;
}

/** Uma fatia do mês vigente: as férias já gozadas ou as que ainda vão acontecer. */
export interface FatiaMes {
  valor: number;
  periodos: number;
  dias: number;
}

export interface PrevistoMesVigente {
  valor: number;
  periodos: number;
  media: number;
  diasAusencia: number;
  pagamentosEmAberto: number;
  /** Férias do mês com gozo já confirmado — a baixa foi dada. */
  tiradas: FatiaMes;
  /** Férias do mês ainda por acontecer: lançadas no Planejamento, aguardando a baixa. */
  aTirar: FatiaMes;
}

/** Uma das duas metades do custo anual, para a tela poder mostrar a origem de cada real. */
export interface ParcelaCusto {
  /** Férias + 1/3 (+ abono e dobra) — a remuneração das férias. */
  valor: number;
  /** FGTS + INSS patronal. */
  encargos: number;
  /** valor + encargos: o desembolso. */
  total: number;
  periodos: number;
}

export interface CustoAnualEstimado {
  valor: number;
  encargos: number;
  percentualEncargos: number;
  programacoesCalculadas: number;
  semSalarioCadastrado: number;
  /**
   * O ano se divide no que já aconteceu e no que ainda vem, e é essa a leitura
   * útil: `realizado` é o dinheiro que já saiu (férias com gozo confirmado) e
   * `porVencimento` é o que ainda está por sair — as férias já planejadas mais
   * o saldo sem programação cujo limite p/ gozo cai até dezembro, que a empresa
   * vai pagar de qualquer jeito porque o prazo não deixa empurrar para o ano
   * seguinte.
   */
  realizado: ParcelaCusto;
  porVencimento: ParcelaCusto;
}

/** Quem está em cada faixa de vencimento — o número sozinho não diz com quem falar. */
export interface PeriodoEmRisco {
  colaboradorNome: string;
  colaboradorDepartamento: string | null;
  /** Última data para INICIAR o gozo do saldo. */
  limiteGozo: string;
  diasRestantes: number;
}

export interface GrupoVencimento {
  quantidade: number;
  periodos: PeriodoEmRisco[];
}

export interface ResumoControle {
  programadas: number;
  realizadas: number;
  pendentes: number;
  vencidas: GrupoVencimento;
  vencendo30: GrupoVencimento;
  vencendo60: GrupoVencimento;
  vencendo90: GrupoVencimento;
}

export interface DashboardFerias {
  ano: number;
  setor: string | null;
  setoresDisponiveis: string[];
  empregadosAtivos: number;
  /** "AAAA-MM" do mês corrente (independe do filtro de ano). */
  competencia: string;
  /** Data (AAAA-MM-DD) do breakdown de folha mais recente já gerado — null se nenhum ainda. */
  dataBaseRelatorio: string | null;
  porTrimestre: ResumoTrimestre[];
  totalAno: { colaboradores: number; valorPago: number; encargos: number };
  jaPago: JaPago;
  previsto: PrevistoMesVigente;
  custoAnual: CustoAnualEstimado;
  colaboradoresSemProgramacao: number;
  controle: ResumoControle;
}

/** Encargos de um item: o que sobra do custo previsto depois da remuneração das férias. */
function encargosDoItem(item: ItemProgramacaoFerias): number {
  return arredondar(item.detalhe.fgts + item.detalhe.inssPatronal);
}

/** Remuneração das férias do item — férias + 1/3 + abono + dobra, sem encargos. */
function feriasDoItem(item: ItemProgramacaoFerias): number {
  return arredondar(item.custoPrevisto - encargosDoItem(item));
}

/**
 * Indicadores do Dashboard de Férias para o ano (e, opcionalmente, setor).
 *
 * A FONTE é a mesma do Planejamento (`listarProgramacaoFerias`) e do Controle
 * (`listarPeriodosAbertos`) — não há cálculo próprio aqui. Antes o dashboard
 * recalculava tudo por conta e chegava a números que não batiam com as telas;
 * agora, se o Planejamento mostra R$ X no Q1, o dashboard mostra R$ X no Q1.
 *
 * O custo anual soma duas metades que nunca se sobrepõem:
 *
 * 1. `realizado` — as férias do ano que já foram gozadas (baixa dada), com o
 *    mesmo valor que o Planejamento mostra na linha.
 * 2. `porVencimento` — o saldo AINDA NÃO lançado (`diasSemLancamento`, que já
 *    desconta tudo que virou lançamento) de períodos cujo limite p/ gozo cai
 *    até dezembro do ano, MAIS as férias já planejadas que ainda não
 *    aconteceram. O saldo sem programação é o único número projetado do
 *    painel, e existe porque a empresa vai pagá-lo mesmo sem programação: o
 *    prazo não deixa adiar. A tela mostra as duas metades separadas.
 */
export async function obterDashboardFerias(
  ano: number = new Date().getFullYear(),
  setor?: string | null,
): Promise<DashboardFerias> {
  const hoje = new Date();
  const todosColaboradores = await listarColaboradores();
  const ativos = todosColaboradores.filter((c) => c.status !== "desligado");
  const setoresDisponiveis = Array.from(
    new Set(ativos.map((c) => c.departamento).filter((d): d is string => Boolean(d))),
  ).sort();
  const colaboradoresFiltrados = setor ? ativos.filter((c) => c.departamento === setor) : ativos;
  const idsFiltrados = new Set(colaboradoresFiltrados.map((c) => c.id));
  const colaboradoresPorId = new Map(todosColaboradores.map((c) => [c.id, c]));

  const [programacao, periodosTodos] = await Promise.all([listarProgramacaoFerias(), listarPeriodosAbertos()]);
  const itens = programacao.filter((i) => idsFiltrados.has(i.colaboradorId));
  const periodos = periodosTodos.filter((p) => idsFiltrados.has(p.colaboradorId));

  const semSalarioIds = new Set<number>();
  for (const i of itens) if (i.semSalario) semSalarioIds.add(i.colaboradorId);

  // --- Por trimestre: exatamente as linhas do Planejamento do ano ---
  const itensDoAno = itens.filter((i) => i.ano === ano);
  const trimestres = new Map<
    number,
    { colaboradores: Set<number>; valorPago: number; encargos: number; linhas: LinhaTrimestre[] }
  >([
    [1, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [2, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [3, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [4, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
  ]);

  for (const item of itensDoAno) {
    const bucket = trimestres.get(item.trimestre)!;
    const ferias = feriasDoItem(item);
    const encargos = encargosDoItem(item);
    bucket.colaboradores.add(item.colaboradorId);
    bucket.valorPago += ferias;
    bucket.encargos += encargos;
    bucket.linhas.push({
      colaboradorNome: item.colaboradorNome,
      colaboradorDepartamento: item.colaboradorDepartamento,
      aquisitivo: `${item.aquisitivoInicio} – ${item.aquisitivoFim}`,
      concessivo: `${item.concessivoInicio} – ${item.concessivoFim}`,
      dias: item.dias,
      valorFerias: ferias,
      encargos,
      total: item.custoPrevisto,
    });
  }

  const porTrimestre: ResumoTrimestre[] = Array.from(trimestres.entries()).map(([trimestre, b]) => ({
    trimestre: trimestre as 1 | 2 | 3 | 4,
    colaboradores: b.colaboradores.size,
    valorPago: arredondar(b.valorPago),
    encargos: arredondar(b.encargos),
    linhas: b.linhas.sort((a, z) => a.colaboradorNome.localeCompare(z.colaboradorNome, "pt-BR")),
  }));

  const totalAno = porTrimestre.reduce(
    (acc, t) => ({
      colaboradores: acc.colaboradores + t.colaboradores,
      valorPago: arredondar(acc.valorPago + t.valorPago),
      encargos: arredondar(acc.encargos + t.encargos),
    }),
    { colaboradores: 0, valorPago: 0, encargos: 0 },
  );

  // --- Metade 1: REALIZADO — quem já tirou as férias (gozo confirmado) ---
  const jaGozados = itensDoAno.filter((i) => i.status === "concluida" || i.status === "alterada");
  const somaItens = (lista: typeof itensDoAno) => ({
    valor: arredondar(lista.reduce((s, i) => s + feriasDoItem(i), 0)),
    encargos: arredondar(lista.reduce((s, i) => s + encargosDoItem(i), 0)),
  });

  const somaRealizado = somaItens(jaGozados);
  const realizado: ParcelaCusto = {
    valor: somaRealizado.valor,
    encargos: somaRealizado.encargos,
    total: arredondar(somaRealizado.valor + somaRealizado.encargos),
    periodos: jaGozados.length,
  };

  // --- Metade 2, parte A: férias já PLANEJADAS que ainda não foram gozadas ---
  const planejadasAbertas = itensDoAno.filter((i) => i.status === "programada");
  const somaPlanejadas = somaItens(planejadasAbertas);

  // --- Metade 2: saldo sem lançamento cujo limite p/ gozo vence até dezembro ---
  // O corte é o LIMITE P/ GOZO (última data para INICIAR o gozo), não o fim do
  // concessivo: é ele que obriga o pagamento dentro do ano. Limite já vencido
  // também entra — atrasado continua sendo desembolso, e mais caro (Art. 137).
  let vencimentoValor = 0;
  let vencimentoEncargos = 0;
  let vencimentoPeriodos = 0;

  for (const periodo of periodos) {
    if (Number(periodo.limiteGozo.slice(0, 4)) > ano) continue;
    const dias = Math.min(periodo.diasSemLancamento, 30);
    if (dias <= 0) continue;

    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;
    if (!colaborador.salarioBase || colaborador.salarioBase <= 0) {
      semSalarioIds.add(colaborador.id);
      continue;
    }

    // Mesma resiliência do resto do portal: sem tabela legal da competência
    // não se estima nada, o período apenas não entra na conta.
    let calculo: ReturnType<typeof calcularFerias> | null = null;
    try {
      calculo = calcularFerias({
        salarioBase: colaborador.salarioBase,
        diasDireito: periodo.diasDireito,
        diasGozados: dias,
        abonoPecuniario: false,
        dependentes: colaborador.dependentes,
        competencia: hoje,
      });
    } catch {
      continue;
    }

    const ferias = arredondar(calculo.detalhe.valorGozado + calculo.detalhe.tercoConstitucional);
    vencimentoValor += ferias;
    vencimentoEncargos += arredondar(calcularFGTS(ferias, hoje).valor + calcularInssPatronal(ferias, hoje).valor);
    vencimentoPeriodos++;
  }

  // Metade 2 = planejado em aberto + saldo que vence até dezembro. As duas
  // parcelas são coisas que ainda vão sair do caixa, e nenhuma se sobrepõe à
  // outra: `diasSemLancamento` já desconta tudo que virou lançamento.
  const porVencimento: ParcelaCusto = {
    valor: arredondar(somaPlanejadas.valor + vencimentoValor),
    encargos: arredondar(somaPlanejadas.encargos + vencimentoEncargos),
    total: arredondar(somaPlanejadas.valor + somaPlanejadas.encargos + vencimentoValor + vencimentoEncargos),
    periodos: planejadasAbertas.length + vencimentoPeriodos,
  };

  const custoAnualValor = arredondar(realizado.total + porVencimento.total);
  const custoAnualEncargos = arredondar(realizado.encargos + porVencimento.encargos);

  const custoAnual: CustoAnualEstimado = {
    valor: custoAnualValor,
    encargos: custoAnualEncargos,
    percentualEncargos: custoAnualValor > 0 ? Math.round((custoAnualEncargos / custoAnualValor) * 100) : 0,
    programacoesCalculadas: realizado.periodos + porVencimento.periodos,
    semSalarioCadastrado: semSalarioIds.size,
    realizado,
    porVencimento,
  };

  // --- Já pago: mesma base do "realizado" acima, aqui pelo desembolso total ---
  const gozados = jaGozados;
  const jaPagoValor = arredondar(gozados.reduce((s, i) => s + i.custoPrevisto, 0));
  const mesesGozados = gozados.map((i) => i.dataInicio.slice(0, 7)).sort();

  const jaPago: JaPago = {
    valor: jaPagoValor,
    periodosPagos: gozados.length,
    mesInicio: mesesGozados[0] ?? null,
    mesFim: mesesGozados[mesesGozados.length - 1] ?? null,
    percentualDoAnual: custoAnualValor > 0 ? Math.round((jaPagoValor / custoAnualValor) * 100) : 0,
  };

  // --- Previsto para o mês vigente: sempre "agora", independe do filtro de ano ---
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const doMesVigente = itens.filter((i) => i.dataInicio.slice(0, 7) === competencia);
  const previstoValor = arredondar(doMesVigente.reduce((s, i) => s + i.custoPrevisto, 0));

  // O total do mês é a soma das duas fatias, e nada além delas: o que já foi
  // gozado e o que está planejado para acontecer. A divisão importa porque uma
  // metade é despesa realizada e a outra ainda pode mudar de data.
  const fatia = (lista: typeof doMesVigente): FatiaMes => ({
    valor: arredondar(lista.reduce((s, i) => s + i.custoPrevisto, 0)),
    periodos: lista.length,
    dias: lista.reduce((s, i) => s + i.dias, 0),
  });

  const previsto: PrevistoMesVigente = {
    valor: previstoValor,
    periodos: doMesVigente.length,
    media: doMesVigente.length > 0 ? arredondar(previstoValor / doMesVigente.length) : 0,
    diasAusencia: doMesVigente.reduce((s, i) => s + i.dias, 0),
    pagamentosEmAberto: doMesVigente.filter((i) => i.status === "programada").length,
    tiradas: fatia(doMesVigente.filter((i) => i.status === "concluida" || i.status === "alterada")),
    aTirar: fatia(doMesVigente.filter((i) => i.status === "programada")),
  };

  // --- Colaboradores com saldo em aberto e nenhum lançamento ainda ---
  const idsComLancamento = new Set(itens.map((i) => i.colaboradorId));
  const semProgramacao = new Set(periodos.filter((p) => p.diasATirar > 0).map((p) => p.colaboradorId));
  for (const id of idsComLancamento) semProgramacao.delete(id);

  const db = await getDb();
  const resultadoDataBase = await db.execute("SELECT MAX(criado_em) as m FROM folha_breakdown");
  const dataBaseRelatorio = resultadoDataBase.rows[0] as unknown as { m: string | null };

  // --- Controle: situação dos períodos/lançamentos no ano ---
  // Só períodos com SALDO entram nos alertas de vencimento: um período já
  // gozado por inteiro continua tendo data de limite, mas não há nada para
  // conceder nele — aparecia como "a vencer" com 0 dias, cobrando uma ação
  // que não existe.
  const periodosDoAno = periodos.filter(
    (p) => p.diasATirar > 0 && Number(p.limiteGozo.slice(0, 4)) === ano,
  );
  const grupo = (lista: typeof periodosDoAno): GrupoVencimento => ({
    quantidade: lista.length,
    periodos: lista
      .map((p) => ({
        colaboradorNome: p.colaboradorNome,
        colaboradorDepartamento: p.colaboradorDepartamento,
        limiteGozo: p.limiteGozo,
        diasRestantes: p.diasATirar,
      }))
      .sort((a, z) => a.limiteGozo.localeCompare(z.limiteGozo)),
  });

  const controle: ResumoControle = {
    programadas: itensDoAno.length,
    realizadas: gozados.length,
    pendentes: itensDoAno.filter((i) => i.status === "programada").length,
    vencidas: grupo(periodosDoAno.filter((p) => p.vencida)),
    vencendo30: grupo(periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer >= 0 && p.diasParaVencer <= 30)),
    vencendo60: grupo(periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer > 30 && p.diasParaVencer <= 60)),
    vencendo90: grupo(periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer > 60 && p.diasParaVencer <= 90)),
  };

  return {
    ano,
    setor: setor ?? null,
    setoresDisponiveis,
    empregadosAtivos: colaboradoresFiltrados.length,
    competencia,
    dataBaseRelatorio: dataBaseRelatorio.m ? dataBaseRelatorio.m.slice(0, 10) : null,
    porTrimestre,
    totalAno,
    jaPago,
    previsto,
    custoAnual,
    colaboradoresSemProgramacao: semProgramacao.size,
    controle,
  };
}
