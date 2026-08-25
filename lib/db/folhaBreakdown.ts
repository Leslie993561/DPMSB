import "server-only";
import { getDb } from "./client";
import { listarColaboradores, type Colaborador } from "./colaboradores";
import { obterDiasUteis } from "./beneficiosDiasUteis";
import { calcularINSS, calcularIRRF, calcularFGTS, calcularValeTransporte, tarifaVtPorCidade, arredondar } from "@/lib/calc";
import type { LinhaExtrasImportada } from "@/lib/parsing/folhaExtras";
import { estaNaFolha } from "@/lib/folha/vigencia";
import { calcularSalarioFamilia, calcularAdicionais } from "@/lib/calc";
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
  /** Hora extra e afins — importados da planilha do mês, nunca calculados aqui. */
  horaExtra50: number | null;
  horaExtra100: number | null;
  descontoHoras: number | null;
  horaNoturna: number | null;
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
  hora_extra_50: number | null;
  hora_extra_100: number | null;
  desconto_horas: number | null;
  hora_noturna: number | null;
  outros_custos: number | null;
}

/** Extras importadas da competência, por colaborador — independem do mês estar fechado ou não. */
export async function obterExtras(competencia: string): Promise<Map<number, ExtrasImportadas>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: `SELECT colaborador_id, vm, odontologico, solides, flash, bonificacao, premiacao, outros_custos,
                 hora_extra_50, hora_extra_100, desconto_horas, hora_noturna
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
        horaExtra50: l.hora_extra_50,
        horaExtra100: l.hora_extra_100,
        descontoHoras: l.desconto_horas,
        horaNoturna: l.hora_noturna,
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
export async function upsertExtras(colaboradorId: number, competencia: string, extras: ExtrasImportadas): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO folha_extras (colaborador_id, competencia, vm, odontologico, solides, flash, bonificacao,
                                 premiacao, outros_custos, hora_extra_50, hora_extra_100, desconto_horas, hora_noturna)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
         vm = excluded.vm, odontologico = excluded.odontologico, solides = excluded.solides, flash = excluded.flash,
         bonificacao = excluded.bonificacao, premiacao = excluded.premiacao, outros_custos = excluded.outros_custos,
         hora_extra_50 = excluded.hora_extra_50, hora_extra_100 = excluded.hora_extra_100,
         desconto_horas = excluded.desconto_horas, hora_noturna = excluded.hora_noturna`,
    args: [
      colaboradorId,
      competencia,
      extras.vm,
      extras.odontologico,
      extras.solides,
      extras.flash,
      extras.bonificacao,
      extras.premiacao,
      extras.outrosCustos,
      extras.horaExtra50,
      extras.horaExtra100,
      extras.descontoHoras,
      extras.horaNoturna,
    ],
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

    // Hora extra soma; desconto de horas subtrai. É a única extra negativa, e
    // vem positiva na planilha justamente porque o DP a informa como desconto.
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
        (extras.horaExtra50 ?? 0) +
        (extras.horaExtra100 ?? 0) +
        (extras.horaNoturna ?? 0) +
        adicionais.total -
        (extras.descontoHoras ?? 0),
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
        (extras.horaExtra50 ?? 0) +
        (extras.horaExtra100 ?? 0) +
        (extras.horaNoturna ?? 0) +
        adicionais.total -
        (extras.descontoHoras ?? 0),
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
export async function importarExtras(itens: LinhaExtrasImportada[], competencia: string): Promise<ResultadoImportacaoExtras> {
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));

  let aplicadas = 0;
  const descartados: ResultadoImportacaoExtras["descartados"] = [];

  for (const [indice, item] of itens.entries()) {
    const linha = indice + 2;
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeColaborador.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.` });
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
    });
    aplicadas++;
  }

  return { aplicadas, descartados };
}
