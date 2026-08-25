import "server-only";
import { getDb } from "./client";
import { listarColaboradores, type Colaborador } from "./colaboradores";
import { obterDiasUteis } from "./beneficiosDiasUteis";
import { calcularINSS, calcularIRRF, calcularFGTS, calcularValeTransporte, tarifaVtPorCidade, arredondar } from "@/lib/calc";
import type { LinhaExtrasImportada, CampoExtra } from "@/lib/parsing/folhaExtras";
import { estaNaFolha } from "@/lib/folha/vigencia";
import { casarPorNome } from "@/lib/folha/casarNome";
import {
  calcularSalarioFamilia,
  calcularAdicionais,
  calcularValorDasHoras,
  JORNADA_MENSAL_PADRAO,
  type CalendarioDsr,
} from "@/lib/calc";
import { listarDependentesPorColaborador } from "./colaboradorDependentes";

export interface VerbaColaborador {
  colaboradorId: number;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  vinculo: string | null;
  salarioBase: number;
  inss: number;
  irrf: number;
  fgts: number;
  provisaoDecimoTerceiro: number;
  valeTransporte: number;
  valeAlimentacao: number;
  /** Verbas "extras" do mês — vêm só de planilha importada (Relatório detalhado), nunca calculadas; `null` = nada importado ainda para esse mês. */
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  outrosCustos: number | null;
  premiacao: number;
  /**
   * HORAS lançadas na planilha do mês, em horas decimais (8,0167 = 08:01).
   * O valor em reais sai do salário — ver `valorHoras`.
   */
  horaExtra50: number | null;
  horaExtra100: number | null;
  descontoHoras: number | null;
  horaNoturna: number | null;
  /** O que essas horas custam, já com os adicionais de cada tipo. */
  valorHoras: {
    valorHoraNormal: number;
    extra50: number;
    extra100: number;
    desconto: number;
    noturna: number;
    /** Reflexo no descanso semanal remunerado. */
    dsr: number;
    /** extra50 + extra100 + noturna + dsr − desconto. */
    liquido: number;
  };
  /**
   * Salário família (Lei 8.213/91 Art. 65): cota por filho menor de 14 anos
   * para quem ganha até o teto do ano. Sai das datas de nascimento dos
   * dependentes cadastrados — sem data de nascimento não há como saber a idade,
   * e a cota não é presumida.
   */
  salarioFamilia: number;
  /** Filhos que geraram a cota. Zero também quando falta a data de nascimento no cadastro. */
  dependentesSalarioFamilia: number;
  /** Adicionais do cadastro. Integram a remuneração e por isso entram na base de INSS, IRRF, FGTS e 13º. */
  periculosidade: number;
  insalubridade: number;
  adicionalFixo: number;
  custoTotal: number;
}

export interface ExtrasImportadas {
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  premiacao: number | null;
  /** HORAS decimais (8,0167 = 08:01), não reais. */
  horaExtra50: number | null;
  horaExtra100: number | null;
  descontoHoras: number | null;
  horaNoturna: number | null;
  outrosCustos: number | null;
}

const EXTRAS_VAZIAS: ExtrasImportadas = {
  vm: null,
  odontologico: null,
  solides: null,
  flash: null,
  bonificacao: null,
  premiacao: null,
  horaExtra50: null,
  horaExtra100: null,
  descontoHoras: null,
  horaNoturna: null,
  outrosCustos: null,
};

interface LinhaExtras {
  colaborador_id: number;
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  premiacao: number | null;
  horas_extra_50: number | null;
  horas_extra_100: number | null;
  horas_desconto: number | null;
  horas_noturnas: number | null;
  outros_custos: number | null;
}

/** Extras importadas da competência, por colaborador — independem do mês estar fechado ou não. */
export async function obterExtras(competencia: string): Promise<Map<number, ExtrasImportadas>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `SELECT colaborador_id, vm, odontologico, solides, flash, bonificacao, premiacao, outros_custos,
                 horas_extra_50, horas_extra_100, horas_desconto, horas_noturnas
          FROM folha_extras WHERE competencia = ?`,
    args: [competencia],
  });
  const linhas = resultado.rows as unknown as LinhaExtras[];

  return new Map(
    linhas.map((l) => [
      l.colaborador_id,
      {
        vm: l.vm,
        odontologico: l.odontologico,
        horaExtra50: l.horas_extra_50,
        horaExtra100: l.horas_extra_100,
        descontoHoras: l.horas_desconto,
        horaNoturna: l.horas_noturnas,
        solides: l.solides,
        flash: l.flash,
        bonificacao: l.bonificacao,
        premiacao: l.premiacao,
        outrosCustos: l.outros_custos,
      },
    ]),
  );
}

/**
 * Grava as extras de um colaborador numa competência — sobrescreve por
 * completo (não mescla com o que já existia). Cada importação representa o
 * estado inteiro daquele mês, igual ao "fechar mês" já faz para o núcleo.
 */
/** Coluna do banco de cada verba, para montar o UPDATE só com o que veio no arquivo. */
const COLUNA_DE = {
  vm: "vm",
  odontologico: "odontologico",
  solides: "solides",
  flash: "flash",
  bonificacao: "bonificacao",
  premiacao: "premiacao",
  horaExtra50: "horas_extra_50",
  horaExtra100: "horas_extra_100",
  descontoHoras: "horas_desconto",
  horaNoturna: "horas_noturnas",
  // "Outros custos" não é uma coluna do arquivo: é a soma das colunas que o
  // portal não reconheceu. Precisa estar aqui mesmo assim, senão ela deixa de
  // ser gravada — foi o que aconteceu quando a gravação passou a ser seletiva.
  outrosCustos: "outros_custos",
} satisfies Partial<Record<CampoExtra | "outrosCustos", string>>;

export type CampoVerba = keyof typeof COLUNA_DE;

/**
 * Grava as verbas do colaborador na competência.
 *
 * `campos` diz quais verbas VIERAM no arquivo; só essas são escritas. Antes o
 * upsert reescrevia todas as colunas, então importar uma planilha só com horas
 * extras zerava VM, odontológico e o resto sem avisar ninguém — o arquivo do DP
 * raramente traz todas as verbas de uma vez.
 *
 * Sem `campos`, mantém o comportamento antigo de escrever tudo (usado quando a
 * origem realmente representa o mês inteiro).
 */
export async function upsertExtras(
  colaboradorId: number,
  competencia: string,
  extras: ExtrasImportadas,
  campos?: CampoVerba[],
): Promise<void> {
  const db = await getDb();
  const aGravar: CampoVerba[] = campos ?? (Object.keys(COLUNA_DE) as CampoVerba[]);
  // Nada a gravar significa arquivo sem nenhuma coluna reconhecida E sem
  // coluna desconhecida — não há o que registrar. Antes o retorno vazio também
  // engolia "outros custos", e a importação não salvava nada.
  if (aGravar.length === 0) return;

  const colunas = aGravar.map((c) => COLUNA_DE[c]);
  const valores = aGravar.map((c) => extras[c] ?? null);
  const placeholders = colunas.map(() => "?").join(", ");
  // COALESCE, e não atribuição direta: célula VAZIA na planilha não apaga o
  // que já existe. Vale a regra do DP — o que não vem na planilha fica como
  // está, e só um valor informado muda o registro. Para zerar de propósito,
  // basta escrever 0, que é um valor e não um vazio.
  const atualizacoes = colunas
    .map((col) => `${col} = COALESCE(excluded.${col}, folha_extras.${col})`)
    .join(", ");

  await db.execute({
    sql: `INSERT INTO folha_extras (colaborador_id, competencia, ${colunas.join(", ")})
       VALUES (?, ?, ${placeholders})
       ON CONFLICT(colaborador_id, competencia) DO UPDATE SET ${atualizacoes}`,
    args: [colaboradorId, competencia, ...valores],
  });
}

function competenciaParaAnoMes(competencia: string): { ano: number; mes: number } {
  const [ano, mes] = competencia.split("-").map(Number);
  return { ano, mes };
}

/**
 * Monta o breakdown "verba a verba" a partir do cadastro de colaboradores —
 * fonte única de verdade (mesma usada por Férias), sem depender de
 * casamento por nome com uma planilha solta. `premiacao` é sempre 0 aqui
 * (não há registro de premiação variável no cadastro); fica disponível na
 * interface para o operador ajustar manualmente antes de fechar o mês, caso
 * o módulo evolua para permitir edição.
 */
export async function gerarBreakdown(competencia: string, colaboradores?: Colaborador[]): Promise<VerbaColaborador[]> {
  const listaColaboradores = colaboradores ?? (await listarColaboradores());
  const { ano, mes } = competenciaParaAnoMes(competencia);
  const diasUteis = await obterDiasUteis(ano, mes);
  // Dias de DSR são o COMPLEMENTO dos dias úteis no mês: se o DP registrou 25
  // úteis num mês de 30 dias, sobram 5 de domingo e feriado. Assim o reflexo
  // usa o mesmo número que o DP já mantém, sem uma segunda tabela para
  // conferir — e sem inventar feriado nenhum.
  const calendarioDsr: CalendarioDsr = {
    diasUteis,
    diasDsr: Math.max(0, new Date(ano, mes, 0).getDate() - diasUteis),
  };
  const dataCompetencia = new Date(`${competencia}-01`);
  const [extrasPorColaborador, dependentesPorColaborador] = await Promise.all([
    obterExtras(competencia),
    listarDependentesPorColaborador(),
  ]);

  return listaColaboradores.filter((c) => estaNaFolha(c, competencia)).map((c) => {
    // PJ é pessoa jurídica prestando serviço, não empregado CLT — não há FGTS,
    // provisão de 13º nem benefícios (VT/VA) estatutários sobre o valor pago a ela.
    const ehPj = c.vinculo === "PJ";

    // Adicionais integram a remuneração para todos os efeitos (INSS, FGTS, 13º),
    // então a base de cálculo é salário + adicionais, não o salário sozinho.
    // Hoje ninguém tem adicional cadastrado, e por isso os números do relatório
    // não mudam; conforme o DP preencher, eles passam a refletir a folha real.
    const adicionais = ehPj
      ? { periculosidade: 0, insalubridade: 0, adicionalFixo: 0, total: 0 }
      : calcularAdicionais(
          {
            salarioBase: c.salarioBase,
            periculosidadePercentual: c.periculosidadePercentual,
            insalubridadePercentual: c.insalubridadePercentual,
            adicionalFixo: c.adicionalFixo,
          },
          dataCompetencia,
        );
    const remuneracao = arredondar(c.salarioBase + adicionais.total);

    // PJ não tem INSS nem IRRF de empregado: o que a empresa paga é nota
    // fiscal de prestação de serviço, não salário. Antes só FGTS, 13º e
    // benefícios eram zerados, e o PJ aparecia no relatório com quase
    // R$ 1.800 de encargos trabalhistas que não existem.
    const inss = ehPj ? { valor: 0 } : calcularINSS(remuneracao, dataCompetencia);
    const irrf = ehPj
      ? { valor: 0 }
      : calcularIRRF(remuneracao - inss.valor, c.dependentes, dataCompetencia);
    const fgts = ehPj ? { valor: 0 } : calcularFGTS(remuneracao, dataCompetencia);
    const provisaoDecimoTerceiro = ehPj ? 0 : arredondar(remuneracao / 12);
    const valeTransporte = ehPj
      ? 0
      : c.tipoTransporte === "vm_fixo"
        ? (c.valorTransporteFixo ?? 0)
        : calcularValeTransporte(c.valorTransporteFixo ?? tarifaVtPorCidade(c.cidade ?? ""), c.salarioBase, diasUteis)
            .valor;
    const valeAlimentacao = ehPj ? 0 : (c.alimentacaoValor ?? 0);
    const extras = extrasPorColaborador.get(c.id) ?? EXTRAS_VAZIAS;
    const premiacao = extras.premiacao ?? 0;

    // Salário família é adiantado pelo empregador e compensado na guia do INSS,
    // então NÃO entra no custo total — aparece na tabela como informação de
    // folha, não como despesa. PJ não tem direito.
    const familia = ehPj
      ? { valor: 0, filhosComCota: 0 }
      : calcularSalarioFamilia(c.salarioBase, dependentesPorColaborador.get(c.id) ?? [], dataCompetencia);

    // As horas lançadas viram dinheiro aqui, pelo salário do colaborador —
    // hora extra soma, desconto subtrai. Ver calcularValorDasHoras.
    const valorHoras = calcularValorDasHoras(
      c.salarioBase,
      {
        extra50: extras.horaExtra50,
        extra100: extras.horaExtra100,
        desconto: extras.descontoHoras,
        noturna: extras.horaNoturna,
      },
      JORNADA_MENSAL_PADRAO,
      calendarioDsr,
    );

    //
    // O ODONTOLÓGICO fica fora da conta de propósito: ele é descontado da folha
    // do colaborador, não pago pela empresa. A empresa recolhe e repassa ao
    // plano, então o desembolso líquido dela é zero — somá-lo inflava o custo
    // de cada pessoa pelo valor do plano.
    const custoTotal = arredondar(
      c.salarioBase +
        fgts.valor +
        provisaoDecimoTerceiro +
        valeTransporte +
        valeAlimentacao +
        premiacao +
        (extras.vm ?? 0) +
        (extras.solides ?? 0) +
        (extras.flash ?? 0) +
        (extras.bonificacao ?? 0) +
        (extras.outrosCustos ?? 0) +
        valorHoras.liquido +
        adicionais.total,
    );

    return {
      colaboradorId: c.id,
      nome: c.nome,
      cargo: c.cargo,
      departamento: c.departamento,
      vinculo: c.vinculo,
      salarioBase: c.salarioBase,
      inss: inss.valor,
      irrf: irrf.valor,
      fgts: fgts.valor,
      provisaoDecimoTerceiro,
      valeTransporte,
      valeAlimentacao,
      vm: extras.vm,
      odontologico: extras.odontologico,
      solides: extras.solides,
      flash: extras.flash,
      bonificacao: extras.bonificacao,
      outrosCustos: extras.outrosCustos,
      premiacao,
      horaExtra50: extras.horaExtra50,
      horaExtra100: extras.horaExtra100,
      descontoHoras: extras.descontoHoras,
      horaNoturna: extras.horaNoturna,
      valorHoras,
      salarioFamilia: familia.valor,
      dependentesSalarioFamilia: familia.filhosComCota,
      periculosidade: adicionais.periculosidade,
      insalubridade: adicionais.insalubridade,
      adicionalFixo: adicionais.adicionalFixo,
      custoTotal,
    };
  });
}

interface LinhaBreakdownPersistida {
  colaborador_id: number;
  competencia: string;
  salario_base: number;
  inss: number;
  irrf: number;
  fgts: number;
  provisao_decimo_terceiro: number;
  vale_transporte: number;
  vale_alimentacao: number;
  outros_beneficios: number;
  premiacao: number;
  custo_total: number;
}

/** Fecha o mês: grava um retrato do breakdown corrente, que passa a não mudar mais mesmo que o cadastro seja alterado depois. */
export async function fecharCompetencia(competencia: string): Promise<VerbaColaborador[]> {
  const colaboradores = await listarColaboradores();
  const linhas = await gerarBreakdown(competencia, colaboradores);
  const db = await getDb();

  if (linhas.length > 0) {
    // Um único INSERT multi-linha (em vez de um por colaborador) — contra um
    // banco remoto, N statements separados custam N idas-e-voltas de rede.
    const grupos = linhas.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)").join(", ");
    const args = linhas.flatMap((l) => [
      l.colaboradorId,
      competencia,
      l.salarioBase,
      l.inss,
      l.irrf,
      l.fgts,
      l.provisaoDecimoTerceiro,
      l.valeTransporte,
      l.valeAlimentacao,
      l.premiacao,
      l.custoTotal,
    ]);
    await db.execute({
      sql: `INSERT INTO folha_breakdown
       (colaborador_id, competencia, salario_base, inss, irrf, fgts, provisao_decimo_terceiro, vale_transporte, vale_alimentacao, outros_beneficios, premiacao, custo_total)
     VALUES ${grupos}
     ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
       salario_base = excluded.salario_base, inss = excluded.inss, irrf = excluded.irrf, fgts = excluded.fgts,
       provisao_decimo_terceiro = excluded.provisao_decimo_terceiro, vale_transporte = excluded.vale_transporte,
       vale_alimentacao = excluded.vale_alimentacao, premiacao = excluded.premiacao, custo_total = excluded.custo_total`,
      args,
    });
  }

  return linhas;
}

/**
 * Reabre o mês: apaga o retrato congelado, e a competência volta a ser
 * calculada ao vivo a partir do cadastro. Só o NÚCLEO some — as verbas extras
 * importadas ficam, porque vivem em `folha_extras` e valem para o mês esteja
 * ele fechado ou aberto.
 *
 * É destrutivo de propósito: depois de reabrir não há como recuperar os
 * valores que estavam congelados, só refazê-los com o cadastro de agora. Quem
 * chama precisa confirmar antes.
 */
export async function reabrirCompetencia(competencia: string): Promise<number> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "DELETE FROM folha_breakdown WHERE competencia = ?",
    args: [competencia],
  });
  return resultado.rowsAffected;
}

export async function competenciaFechada(competencia: string): Promise<boolean> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT COUNT(*) as n FROM folha_breakdown WHERE competencia = ?",
    args: [competencia],
  });
  const linha = resultado.rows[0] as unknown as { n: number };
  return linha.n > 0;
}

export async function listarBreakdownPersistido(competencia: string): Promise<VerbaColaborador[]> {
  const colaboradoresPorId = new Map((await listarColaboradores()).map((c) => [c.id, c]));
  const dataCompetencia = new Date(`${competencia}-01`);
  // Mesmo calendário do caminho ao vivo — ver gerarBreakdown.
  const { ano: anoComp, mes: mesComp } = competenciaParaAnoMes(competencia);
  const diasUteisComp = await obterDiasUteis(anoComp, mesComp);
  const calendarioDsr: CalendarioDsr = {
    diasUteis: diasUteisComp,
    diasDsr: Math.max(0, new Date(anoComp, mesComp, 0).getDate() - diasUteisComp),
  };
  const [extrasPorColaborador, dependentesPorColaborador] = await Promise.all([
    obterExtras(competencia),
    listarDependentesPorColaborador(),
  ]);
  const db = await getDb();
  const resultado = await db.execute({ sql: "SELECT * FROM folha_breakdown WHERE competencia = ?", args: [competencia] });
  const linhas = resultado.rows as unknown as LinhaBreakdownPersistida[];

  return linhas.map((l) => {
    const colaborador = colaboradoresPorId.get(l.colaborador_id);
    // Núcleo (salário/encargos/VT/VA) fica congelado no fechamento; as extras
    // (importadas à parte) continuam valendo mesmo depois do mês fechado.
    const nucleoCongelado = arredondar(
      l.salario_base + l.fgts + l.provisao_decimo_terceiro + l.vale_transporte + l.vale_alimentacao,
    );
    const extras = extrasPorColaborador.get(l.colaborador_id) ?? EXTRAS_VAZIAS;
    const premiacao = extras.premiacao ?? 0;
    // Mês fechado: o núcleo (salário e encargos) está congelado e não é
    // recalculado. Os adicionais entram só como informação e no custo — se o
    // cadastro mudou depois do fechamento, os encargos gravados continuam
    // valendo, que é o sentido de fechar o mês.
    const adicionais =
      colaborador && colaborador.vinculo !== "PJ"
        ? calcularAdicionais(
            {
              salarioBase: colaborador.salarioBase,
              periculosidadePercentual: colaborador.periculosidadePercentual,
              insalubridadePercentual: colaborador.insalubridadePercentual,
              adicionalFixo: colaborador.adicionalFixo,
            },
            dataCompetencia,
          )
        : { periculosidade: 0, insalubridade: 0, adicionalFixo: 0, total: 0 };
    const valorHoras = calcularValorDasHoras(
      colaborador?.salarioBase ?? 0,
      {
        extra50: extras.horaExtra50,
        extra100: extras.horaExtra100,
        desconto: extras.descontoHoras,
        noturna: extras.horaNoturna,
      },
      JORNADA_MENSAL_PADRAO,
      calendarioDsr,
    );
    const familia =
      colaborador && colaborador.vinculo !== "PJ"
        ? calcularSalarioFamilia(
            colaborador.salarioBase,
            dependentesPorColaborador.get(l.colaborador_id) ?? [],
            dataCompetencia,
          )
        : { valor: 0, filhosComCota: 0 };
    const custoTotal = arredondar(
      nucleoCongelado +
        premiacao +
        (extras.vm ?? 0) +
        (extras.solides ?? 0) +
        (extras.flash ?? 0) +
        (extras.bonificacao ?? 0) +
        (extras.outrosCustos ?? 0) +
        valorHoras.liquido +
        adicionais.total,
    );

    return {
      colaboradorId: l.colaborador_id,
      nome: colaborador?.nome ?? `Colaborador #${l.colaborador_id}`,
      cargo: colaborador?.cargo ?? null,
      departamento: colaborador?.departamento ?? null,
      vinculo: colaborador?.vinculo ?? null,
      salarioBase: l.salario_base,
      inss: l.inss,
      irrf: l.irrf,
      fgts: l.fgts,
      provisaoDecimoTerceiro: l.provisao_decimo_terceiro,
      valeTransporte: l.vale_transporte,
      valeAlimentacao: l.vale_alimentacao,
      vm: extras.vm,
      odontologico: extras.odontologico,
      solides: extras.solides,
      flash: extras.flash,
      bonificacao: extras.bonificacao,
      outrosCustos: extras.outrosCustos,
      premiacao,
      horaExtra50: extras.horaExtra50,
      horaExtra100: extras.horaExtra100,
      descontoHoras: extras.descontoHoras,
      horaNoturna: extras.horaNoturna,
      valorHoras,
      salarioFamilia: familia.valor,
      dependentesSalarioFamilia: familia.filhosComCota,
      periculosidade: adicionais.periculosidade,
      insalubridade: adicionais.insalubridade,
      adicionalFixo: adicionais.adicionalFixo,
      custoTotal,
    };
  });
}

/** Breakdown da competência: se o mês já foi fechado, retorna o retrato salvo; senão, uma prévia calculada ao vivo. */
export async function obterBreakdown(competencia: string): Promise<{ linhas: VerbaColaborador[]; fechado: boolean }> {
  if (await competenciaFechada(competencia)) {
    return { linhas: await listarBreakdownPersistido(competencia), fechado: true };
  }
  return { linhas: await gerarBreakdown(competencia), fechado: false };
}

export async function listarCompetenciasFechadas(): Promise<string[]> {
  const db = await getDb();
  const resultado = await db.execute("SELECT DISTINCT competencia FROM folha_breakdown ORDER BY competencia DESC");
  const linhas = resultado.rows as unknown as { competencia: string }[];
  return linhas.map((l) => l.competencia);
}

export interface ResumoTrimestre {
  trimestre: 1 | 2 | 3 | 4;
  custoTotal: number;
  colaboradores: number;
  /** true se algum dos 3 meses do trimestre ainda não foi fechado — usa a folha atual projetada, não um fato consumado. */
  projecao: boolean;
  porVinculo: { vinculo: string; custoTotal: number }[];
}

const MESES_POR_TRIMESTRE: Record<1 | 2 | 3 | 4, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

/**
 * Custo total por trimestre do ano — soma o breakdown mês a mês (real, se o
 * mês já foi fechado; projeção com a folha/dias úteis atuais, senão), nunca
 * um número estimado à parte. `dias úteis` variam por mês (afeta VT), por
 * isso a projeção recalcula cada mês, em vez de multiplicar um mês por 3.
 */
export async function obterResumoTrimestral(ano: number): Promise<ResumoTrimestre[]> {
  return Promise.all(
    ([1, 2, 3, 4] as const).map(async (trimestre) => {
      let custoTotal = 0;
      let projecao = false;
      const colaboradoresSet = new Set<number>();
      const porVinculoMap = new Map<string, number>();

      for (const mes of MESES_POR_TRIMESTRE[trimestre]) {
        const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
        const { linhas, fechado } = await obterBreakdown(competencia);
        if (!fechado) projecao = true;
        for (const l of linhas) {
          custoTotal += l.custoTotal;
          colaboradoresSet.add(l.colaboradorId);
          const chave = l.vinculo ?? "Não informado";
          porVinculoMap.set(chave, (porVinculoMap.get(chave) ?? 0) + l.custoTotal);
        }
      }

      return {
        trimestre,
        custoTotal: arredondar(custoTotal),
        colaboradores: colaboradoresSet.size,
        projecao,
        porVinculo: Array.from(porVinculoMap.entries()).map(([vinculo, custo]) => ({
          vinculo,
          custoTotal: arredondar(custo),
        })),
      };
    }),
  );
}

export interface ResultadoImportacaoExtras {
  aplicadas: number;
  descartados: { linha: number; motivo: string }[];
}

/**
 * Aplica as verbas extras (VM, odontológico, Sólides, Flash, bonificação,
 * premiação, outros custos) de uma planilha importada à competência —
 * casamento por código (se houver) e, senão, por nome do colaborador.
 */
export async function importarExtras(
  itens: LinhaExtrasImportada[],
  competencia: string,
  camposPresentes?: CampoVerba[],
): Promise<ResultadoImportacaoExtras> {
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));

  let aplicadas = 0;
  const descartados: ResultadoImportacaoExtras["descartados"] = [];

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2;
    // Código primeiro; sem ele, o nome com tolerância a acento e conectivo.
    const porCodigoAchado = item.codigo ? porCodigo.get(item.codigo.trim()) : undefined;
    const porNomeAchado = porCodigoAchado
      ? { encontrado: porCodigoAchado, ambiguo: false }
      : casarPorNome(item.nomeColaborador, colaboradores, (c) => c.nome);
    const colaborador = porNomeAchado.encontrado;

    if (!colaborador) {
      descartados.push({
        linha,
        motivo: porNomeAchado.ambiguo
          ? `"${item.nomeColaborador}" casa com mais de um colaborador — informe o código para não aplicar na pessoa errada.`
          : `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.`,
      });
      continue;
    }

    await upsertExtras(colaborador.id, competencia, {
      vm: item.vm,
      odontologico: item.odontologico,
      solides: item.solides,
      flash: item.flash,
      bonificacao: item.bonificacao,
      premiacao: item.premiacao,
      horaExtra50: item.horaExtra50,
      horaExtra100: item.horaExtra100,
      descontoHoras: item.descontoHoras,
      horaNoturna: item.horaNoturna,
      outrosCustos: item.outrosCustos,
    }, camposPresentes);
    aplicadas++;
  }

  return { aplicadas, descartados };
}
