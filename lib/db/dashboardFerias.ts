import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { listarPeriodosAbertos } from "./periodosAquisitivos";
import { calcularFerias, calcularFGTS, calcularInssPatronal, arredondar } from "@/lib/calc";

export interface LinhaTrimestre {
  colaboradorNome: string;
  colaboradorDepartamento: string | null;
  aquisitivo: string;
  concessivo: string;
  dias: number;
  valorFerias: number;
  encargos: number;
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

export interface PrevistoMesVigente {
  valor: number;
  periodos: number;
  media: number;
  diasAusencia: number;
  pagamentosEmAberto: number;
}

export interface CustoAnualEstimado {
  valor: number;
  encargos: number;
  percentualEncargos: number;
  programacoesCalculadas: number;
  semSalarioCadastrado: number;
}

export interface ResumoControle {
  programadas: number;
  realizadas: number;
  pendentes: number;
  vencidas: number;
  vencendo30: number;
  vencendo60: number;
  vencendo90: number;
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

interface LinhaLancamentoResumo {
  status: "programada" | "concluida" | "cancelada" | "alterada";
  dias: number;
  abono: number;
  data_inicio_prevista: string | null;
  data_inicio_gozo: string | null;
  colaborador_id: number;
  dias_direito: number;
}

interface EventoCalculado {
  colaboradorId: number;
  dataRef: Date;
  status: LinhaLancamentoResumo["status"];
  dias: number;
  bruto: number;
  encargos: number;
  semSalario: boolean;
}

/**
 * Agrega os indicadores do Dashboard de Férias para o ano (e, opcionalmente,
 * setor) informados. Dois componentes de custo, sempre complementares —
 * nunca sobrepostos — compõem o "custo anual estimado":
 *
 * 1. `eventos` — lançamentos reais (programados/concluídos) já registrados
 *    em `lancamentos_ferias`, valorados com o motor determinístico
 *    (`calcularFerias`/`calcularFGTS`/`calcularInssPatronal`) na competência
 *    de cada evento.
 * 2. `porTrimestre` — o saldo AINDA NÃO lançado dos períodos em aberto
 *    (`diasSemLancamento`, que desconta TANTO os já confirmados quanto os
 *    programados/não confirmados — os dois já cobertos por (1) — para nunca
 *    contar a mesma férias duas vezes).
 *
 * Nunca um número inventado: tudo vem de `lancamentos_ferias`/
 * `periodos_aquisitivos` reais passados pelas funções de `lib/calc`.
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

  const semSalarioIds = new Set<number>();

  // --- Por trimestre: saldo ainda não lançado dos períodos em aberto ---
  const periodos = (await listarPeriodosAbertos()).filter((p) => idsFiltrados.has(p.colaboradorId));
  const trimestres = new Map<
    number,
    { colaboradores: Set<number>; valorPago: number; encargos: number; linhas: LinhaTrimestre[] }
  >([
    [1, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [2, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [3, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
    [4, { colaboradores: new Set(), valorPago: 0, encargos: 0, linhas: [] }],
  ]);

  for (const periodo of periodos) {
    const colaborador = colaboradoresPorId.get(periodo.colaboradorId);
    if (!colaborador) continue;
    if (Number(periodo.concessivoFim.slice(0, 4)) !== ano) continue;

    const diasEstimativa = Math.min(periodo.diasSemLancamento, 30);
    if (diasEstimativa <= 0) continue;

    if (!colaborador.salarioBase || colaborador.salarioBase <= 0) semSalarioIds.add(colaborador.id);

    const resultado = calcularFerias({
      salarioBase: colaborador.salarioBase,
      diasDireito: 30,
      diasGozados: diasEstimativa,
      abonoPecuniario: false,
      dependentes: colaborador.dependentes,
      competencia: hoje,
    });
    const bruto = arredondar(resultado.detalhe.valorGozado + resultado.detalhe.tercoConstitucional);
    const fgts = calcularFGTS(bruto, hoje).valor;
    const patronal = calcularInssPatronal(bruto, hoje).valor;
    const encargos = arredondar(fgts + patronal);

    const trimestre = Math.ceil(Number(periodo.concessivoFim.slice(5, 7)) / 3);
    const bucket = trimestres.get(trimestre)!;
    bucket.colaboradores.add(periodo.colaboradorId);
    bucket.valorPago += bruto;
    bucket.encargos += encargos;
    bucket.linhas.push({
      colaboradorNome: periodo.colaboradorNome,
      colaboradorDepartamento: periodo.colaboradorDepartamento,
      aquisitivo: `${periodo.dataInicio} – ${periodo.dataFim}`,
      concessivo: `${periodo.concessivoInicio} – ${periodo.concessivoFim}`,
      dias: diasEstimativa,
      valorFerias: bruto,
      encargos,
      total: arredondar(bruto + encargos),
    });
  }

  const porTrimestre: ResumoTrimestre[] = Array.from(trimestres.entries()).map(([trimestre, b]) => ({
    trimestre: trimestre as 1 | 2 | 3 | 4,
    colaboradores: b.colaboradores.size,
    valorPago: arredondar(b.valorPago),
    encargos: arredondar(b.encargos),
    linhas: b.linhas.sort((a, z) => a.colaboradorNome.localeCompare(z.colaboradorNome)),
  }));

  const totalAno = porTrimestre.reduce(
    (acc, t) => ({
      colaboradores: acc.colaboradores + t.colaboradores,
      valorPago: arredondar(acc.valorPago + t.valorPago),
      encargos: arredondar(acc.encargos + t.encargos),
    }),
    { colaboradores: 0, valorPago: 0, encargos: 0 },
  );

  // --- Lançamentos reais (já programados/concluídos) ---
  const db = await getDb();
  const resultadoLancamentos = await db.execute(
    `SELECT l.status, l.dias, l.abono, l.data_inicio_prevista, l.data_inicio_gozo,
              p.colaborador_id, p.dias_direito
       FROM lancamentos_ferias l
       JOIN periodos_aquisitivos p ON p.id = l.periodo_aquisitivo_id
       WHERE l.status != 'cancelada'`,
  );
  const linhasLancamentos = resultadoLancamentos.rows as unknown as LinhaLancamentoResumo[];

  function calcularEvento(l: LinhaLancamentoResumo): EventoCalculado | null {
    if (!idsFiltrados.has(l.colaborador_id)) return null;
    const colaborador = colaboradoresPorId.get(l.colaborador_id);
    if (!colaborador) return null;
    const dataRefStr = l.data_inicio_gozo ?? l.data_inicio_prevista;
    if (!dataRefStr) return null;
    const dataRef = new Date(dataRefStr);

    const semSalario = !colaborador.salarioBase || colaborador.salarioBase <= 0;
    const resultado = calcularFerias({
      salarioBase: colaborador.salarioBase,
      diasDireito: l.dias_direito,
      diasGozados: l.dias,
      abonoPecuniario: Boolean(l.abono),
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
    const encargos = arredondar(fgts + patronal);

    return { colaboradorId: l.colaborador_id, dataRef, status: l.status, dias: l.dias, bruto, encargos, semSalario };
  }

  const eventosCalculados = linhasLancamentos
    .map(calcularEvento)
    .filter((e): e is EventoCalculado => e !== null);

  const eventosDoAno = eventosCalculados.filter((e) => e.dataRef.getFullYear() === ano);
  const eventosDoMesVigente = eventosCalculados.filter(
    (e) => e.dataRef.getFullYear() === hoje.getFullYear() && e.dataRef.getMonth() === hoje.getMonth(),
  );

  eventosDoAno.forEach((e) => {
    if (e.semSalario) semSalarioIds.add(e.colaboradorId);
  });

  // --- Custo anual estimado: eventos reais do ano + saldo ainda não lançado (por trimestre) ---
  const custoEventosAno = eventosDoAno.reduce(
    (acc, e) => ({ valor: acc.valor + e.bruto, encargos: acc.encargos + e.encargos }),
    { valor: 0, encargos: 0 },
  );
  const custoAnualValor = arredondar(
    custoEventosAno.valor + custoEventosAno.encargos + totalAno.valorPago + totalAno.encargos,
  );
  const custoAnualEncargos = arredondar(custoEventosAno.encargos + totalAno.encargos);
  const programacoesCalculadas = eventosDoAno.length + porTrimestre.reduce((s, t) => s + t.linhas.length, 0);

  const custoAnual: CustoAnualEstimado = {
    valor: custoAnualValor,
    encargos: custoAnualEncargos,
    percentualEncargos: custoAnualValor > 0 ? Math.round((custoAnualEncargos / custoAnualValor) * 100) : 0,
    programacoesCalculadas,
    semSalarioCadastrado: semSalarioIds.size,
  };

  // --- Já pago: eventos com gozo confirmado no ano (baixa dada — concluída ou com dias alterados na baixa) ---
  const concluidosDoAno = eventosDoAno.filter((e) => e.status === "concluida" || e.status === "alterada");
  const jaPagoValor = arredondar(concluidosDoAno.reduce((s, e) => s + e.bruto + e.encargos, 0));
  const mesesConcluidos = concluidosDoAno
    .map((e) => `${e.dataRef.getFullYear()}-${String(e.dataRef.getMonth() + 1).padStart(2, "0")}`)
    .sort();

  const jaPago: JaPago = {
    valor: jaPagoValor,
    periodosPagos: concluidosDoAno.length,
    mesInicio: mesesConcluidos[0] ?? null,
    mesFim: mesesConcluidos[mesesConcluidos.length - 1] ?? null,
    percentualDoAnual: custoAnualValor > 0 ? Math.round((jaPagoValor / custoAnualValor) * 100) : 0,
  };

  // --- Previsto para o mês vigente (independe do filtro de ano — é sempre "agora") ---
  const previstoValor = arredondar(eventosDoMesVigente.reduce((s, e) => s + e.bruto + e.encargos, 0));
  const previstoDias = eventosDoMesVigente.reduce((s, e) => s + e.dias, 0);
  const previsto: PrevistoMesVigente = {
    valor: previstoValor,
    periodos: eventosDoMesVigente.length,
    media: eventosDoMesVigente.length > 0 ? arredondar(previstoValor / eventosDoMesVigente.length) : 0,
    diasAusencia: previstoDias,
    pagamentosEmAberto: eventosDoMesVigente.filter((e) => e.status === "programada").length,
  };

  // --- Colaboradores com período em aberto neste ano mas nenhum lançamento ainda (nunca programaram) ---
  const idsComLancamento = new Set(linhasLancamentos.map((l) => l.colaborador_id));
  const colaboradoresSemProgramacao = new Set(
    periodos.filter((p) => p.diasATirar > 0).map((p) => p.colaboradorId),
  );
  for (const id of idsComLancamento) colaboradoresSemProgramacao.delete(id);

  const resultadoDataBase = await db.execute("SELECT MAX(criado_em) as m FROM folha_breakdown");
  const dataBaseRelatorio = resultadoDataBase.rows[0] as unknown as { m: string | null };

  // --- Controle: situação dos períodos/lançamentos no ano ---
  const periodosDoAno = periodos.filter((p) => Number(p.concessivoFim.slice(0, 4)) === ano);
  const controle: ResumoControle = {
    programadas: eventosDoAno.length,
    realizadas: concluidosDoAno.length,
    pendentes: eventosDoAno.filter((e) => e.status === "programada").length,
    vencidas: periodosDoAno.filter((p) => p.vencida).length,
    vencendo30: periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer >= 0 && p.diasParaVencer <= 30).length,
    vencendo60: periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer > 30 && p.diasParaVencer <= 60).length,
    vencendo90: periodosDoAno.filter((p) => !p.vencida && p.diasParaVencer > 60 && p.diasParaVencer <= 90).length,
  };

  return {
    ano,
    setor: setor ?? null,
    setoresDisponiveis,
    empregadosAtivos: colaboradoresFiltrados.length,
    competencia: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`,
    dataBaseRelatorio: dataBaseRelatorio.m ? dataBaseRelatorio.m.slice(0, 10) : null,
    porTrimestre,
    totalAno,
    jaPago,
    previsto,
    custoAnual,
    colaboradoresSemProgramacao: colaboradoresSemProgramacao.size,
    controle,
  };
}
