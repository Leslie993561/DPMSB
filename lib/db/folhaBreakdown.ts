import "server-only";
import { getDb } from "./client";
import { listarColaboradores, type Colaborador } from "./colaboradores";
import { obterDiasUteis } from "./beneficiosDiasUteis";
import { calcularINSS, calcularIRRF, calcularFGTS, calcularValeTransporte, tarifaVtPorCidade, arredondar } from "@/lib/calc";
import type { LinhaExtrasImportada } from "@/lib/parsing/folhaExtras";

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
  custoTotal: number;
}

export interface ExtrasImportadas {
  vm: number | null;
  odontologico: number | null;
  solides: number | null;
  flash: number | null;
  bonificacao: number | null;
  premiacao: number | null;
  outrosCustos: number | null;
}

const EXTRAS_VAZIAS: ExtrasImportadas = {
  vm: null,
  odontologico: null,
  solides: null,
  flash: null,
  bonificacao: null,
  premiacao: null,
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
  outros_custos: number | null;
}

/** Extras importadas da competência, por colaborador — independem do mês estar fechado ou não. */
export function obterExtras(competencia: string): Map<number, ExtrasImportadas> {
  const linhas = getDb()
    .prepare(
      "SELECT colaborador_id, vm, odontologico, solides, flash, bonificacao, premiacao, outros_custos FROM folha_extras WHERE competencia = ?",
    )
    .all(competencia) as unknown as LinhaExtras[];

  return new Map(
    linhas.map((l) => [
      l.colaborador_id,
      {
        vm: l.vm,
        odontologico: l.odontologico,
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
export function upsertExtras(colaboradorId: number, competencia: string, extras: ExtrasImportadas): void {
  getDb()
    .prepare(
      `INSERT INTO folha_extras (colaborador_id, competencia, vm, odontologico, solides, flash, bonificacao, premiacao, outros_custos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
         vm = excluded.vm, odontologico = excluded.odontologico, solides = excluded.solides, flash = excluded.flash,
         bonificacao = excluded.bonificacao, premiacao = excluded.premiacao, outros_custos = excluded.outros_custos`,
    )
    .run(
      colaboradorId,
      competencia,
      extras.vm,
      extras.odontologico,
      extras.solides,
      extras.flash,
      extras.bonificacao,
      extras.premiacao,
      extras.outrosCustos,
    );
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
export function gerarBreakdown(competencia: string, colaboradores: Colaborador[] = listarColaboradores()): VerbaColaborador[] {
  const { ano, mes } = competenciaParaAnoMes(competencia);
  const diasUteis = obterDiasUteis(ano, mes);
  const dataCompetencia = new Date(`${competencia}-01`);
  const extrasPorColaborador = obterExtras(competencia);

  return colaboradores.map((c) => {
    // PJ é pessoa jurídica prestando serviço, não empregado CLT — não há FGTS,
    // provisão de 13º nem benefícios (VT/VA) estatutários sobre o valor pago a ela.
    const ehPj = c.vinculo === "PJ";

    const inss = calcularINSS(c.salarioBase, dataCompetencia);
    const irrf = calcularIRRF(c.salarioBase - inss.valor, c.dependentes, dataCompetencia);
    const fgts = ehPj ? { valor: 0 } : calcularFGTS(c.salarioBase, dataCompetencia);
    const provisaoDecimoTerceiro = ehPj ? 0 : arredondar(c.salarioBase / 12);
    const valeTransporte = ehPj
      ? 0
      : c.tipoTransporte === "vm_fixo"
        ? (c.valorTransporteFixo ?? 0)
        : calcularValeTransporte(c.valorTransporteFixo ?? tarifaVtPorCidade(c.cidade ?? ""), c.salarioBase, diasUteis)
            .valor;
    const valeAlimentacao = ehPj ? 0 : (c.alimentacaoValor ?? 0);
    const extras = extrasPorColaborador.get(c.id) ?? EXTRAS_VAZIAS;
    const premiacao = extras.premiacao ?? 0;

    const custoTotal = arredondar(
      c.salarioBase +
        fgts.valor +
        provisaoDecimoTerceiro +
        valeTransporte +
        valeAlimentacao +
        premiacao +
        (extras.vm ?? 0) +
        (extras.odontologico ?? 0) +
        (extras.solides ?? 0) +
        (extras.flash ?? 0) +
        (extras.bonificacao ?? 0) +
        (extras.outrosCustos ?? 0),
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
export function fecharCompetencia(competencia: string): VerbaColaborador[] {
  const colaboradores = listarColaboradores();
  const linhas = gerarBreakdown(competencia, colaboradores);
  const db = getDb();

  const upsert = db.prepare(
    `INSERT INTO folha_breakdown
       (colaborador_id, competencia, salario_base, inss, irrf, fgts, provisao_decimo_terceiro, vale_transporte, vale_alimentacao, outros_beneficios, premiacao, custo_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(colaborador_id, competencia) DO UPDATE SET
       salario_base = excluded.salario_base, inss = excluded.inss, irrf = excluded.irrf, fgts = excluded.fgts,
       provisao_decimo_terceiro = excluded.provisao_decimo_terceiro, vale_transporte = excluded.vale_transporte,
       vale_alimentacao = excluded.vale_alimentacao, premiacao = excluded.premiacao, custo_total = excluded.custo_total`,
  );

  for (const l of linhas) {
    upsert.run(
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
    );
  }

  return linhas;
}

export function competenciaFechada(competencia: string): boolean {
  const linha = getDb()
    .prepare("SELECT COUNT(*) as n FROM folha_breakdown WHERE competencia = ?")
    .get(competencia) as { n: number };
  return linha.n > 0;
}

export function listarBreakdownPersistido(competencia: string): VerbaColaborador[] {
  const colaboradoresPorId = new Map(listarColaboradores().map((c) => [c.id, c]));
  const extrasPorColaborador = obterExtras(competencia);
  const linhas = getDb()
    .prepare("SELECT * FROM folha_breakdown WHERE competencia = ?")
    .all(competencia) as unknown as LinhaBreakdownPersistida[];

  return linhas.map((l) => {
    const colaborador = colaboradoresPorId.get(l.colaborador_id);
    // Núcleo (salário/encargos/VT/VA) fica congelado no fechamento; as extras
    // (importadas à parte) continuam valendo mesmo depois do mês fechado.
    const nucleoCongelado = arredondar(
      l.salario_base + l.fgts + l.provisao_decimo_terceiro + l.vale_transporte + l.vale_alimentacao,
    );
    const extras = extrasPorColaborador.get(l.colaborador_id) ?? EXTRAS_VAZIAS;
    const premiacao = extras.premiacao ?? 0;
    const custoTotal = arredondar(
      nucleoCongelado +
        premiacao +
        (extras.vm ?? 0) +
        (extras.odontologico ?? 0) +
        (extras.solides ?? 0) +
        (extras.flash ?? 0) +
        (extras.bonificacao ?? 0) +
        (extras.outrosCustos ?? 0),
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
      custoTotal,
    };
  });
}

/** Breakdown da competência: se o mês já foi fechado, retorna o retrato salvo; senão, uma prévia calculada ao vivo. */
export function obterBreakdown(competencia: string): { linhas: VerbaColaborador[]; fechado: boolean } {
  if (competenciaFechada(competencia)) {
    return { linhas: listarBreakdownPersistido(competencia), fechado: true };
  }
  return { linhas: gerarBreakdown(competencia), fechado: false };
}

export function listarCompetenciasFechadas(): string[] {
  const linhas = getDb()
    .prepare("SELECT DISTINCT competencia FROM folha_breakdown ORDER BY competencia DESC")
    .all() as unknown as { competencia: string }[];
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
export function obterResumoTrimestral(ano: number): ResumoTrimestre[] {
  return ([1, 2, 3, 4] as const).map((trimestre) => {
    let custoTotal = 0;
    let projecao = false;
    const colaboradoresSet = new Set<number>();
    const porVinculoMap = new Map<string, number>();

    for (const mes of MESES_POR_TRIMESTRE[trimestre]) {
      const competencia = `${ano}-${String(mes).padStart(2, "0")}`;
      const { linhas, fechado } = obterBreakdown(competencia);
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
  });
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
export function importarExtras(itens: LinhaExtrasImportada[], competencia: string): ResultadoImportacaoExtras {
  const colaboradores = listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));

  let aplicadas = 0;
  const descartados: ResultadoImportacaoExtras["descartados"] = [];

  itens.forEach((item, indice) => {
    const linha = indice + 2;
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeColaborador.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.` });
      return;
    }

    upsertExtras(colaborador.id, competencia, {
      vm: item.vm,
      odontologico: item.odontologico,
      solides: item.solides,
      flash: item.flash,
      bonificacao: item.bonificacao,
      premiacao: item.premiacao,
      outrosCustos: item.outrosCustos,
    });
    aplicadas++;
  });

  return { aplicadas, descartados };
}
