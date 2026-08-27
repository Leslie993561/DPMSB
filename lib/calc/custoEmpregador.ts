import { getLegalTable } from "../legal-tables";
import { arredondar, type MemoriaCalculoStep } from "./types";

/**
 * RAT efetivo da MSB: RAT nominal 2% × FAP 0,5000 = 1,00%.
 *
 * O FAP é por CNPJ e sai todo ano no gov.br/fap-mps. Este é o confirmado para
 * 2026 no CNPJ 06.167.295/0001-71. Se o FAP mudar, muda aqui — e o número
 * aparece na memória de cálculo justamente para que a mudança seja percebida
 * em vez de ficar escondida numa constante.
 */
export const RAT_NOMINAL = 0.02;
export const FAP = 0.5;
export const RAT_EFETIVO = RAT_NOMINAL * FAP;

/** Contribuições a terceiros (Sistema S, INCRA, SEBRAE, salário-educação). */
export const TERCEIROS = 0.058;

/** FGTS reduzido do contrato de aprendizagem (Lei 10.097/2000, Art. 15 §7º da Lei 8.036/90). */
export const FGTS_APRENDIZ = 0.02;

/** Provisões: 13º e férias rendem 1/12 ao mês; o 1/3 constitucional, 1/36. */
export const PROVISAO_DECIMO_TERCEIRO = 1 / 12;
export const PROVISAO_FERIAS = 1 / 12;
export const PROVISAO_TERCO_FERIAS = 1 / 36;

/** Regime de encargos do colaborador — muda só a alíquota de FGTS. */
export type RegimeEncargos = "celetista" | "aprendiz";

export interface ComponenteCusto {
  label: string;
  /** Alíquota sobre o salário, para exibir ao lado do valor. */
  percentual: number;
  valor: number;
}

export interface CustoMensalEmpregador {
  salarioBase: number;
  inssPatronal: number;
  rat: number;
  terceiros: number;
  fgts: number;
  provisaoDecimoTerceiro: number;
  provisaoFerias: number;
  provisaoTercoFerias: number;
  /** INSS patronal + RAT + Terceiros + FGTS. */
  encargosDiretos: number;
  /** 13º + férias + 1/3 de férias. */
  provisoes: number;
  /** Os mesmos encargos diretos incidindo sobre as provisões quando forem pagas. */
  encargosSobreProvisoes: number;
  /** Salário + encargos diretos + provisões + encargos sobre as provisões. */
  total: number;
  /** Alíquotas somadas, para conferência: 34,80% celetista, 28,80% aprendiz. */
  aliquotaEncargosDiretos: number;
  aliquotaProvisoes: number;
  aliquotaEncargosSobreProvisoes: number;
  linhas: ComponenteCusto[];
  memoriaCalculo: MemoriaCalculoStep[];
}

/**
 * Custo mensal do empregador por colaborador CLT.
 *
 * O Breakdown somava só FGTS e provisão de 13º, e por isso subestimava o custo
 * de cada celetista em quase um terço do salário: faltavam INSS patronal, RAT,
 * Terceiros, provisão de férias, o 1/3 constitucional e os encargos que
 * incidem sobre as provisões quando elas viram pagamento.
 *
 * A composição segue o demonstrativo do DP, linha por linha:
 *
 *   celetista  100% + 34,80% diretos + 19,44% provisões + 6,77% sobre provisões
 *   aprendiz   100% + 28,80% diretos + 19,44% provisões + 5,60% sobre provisões
 *
 * A diferença entre os dois é só o FGTS: 8% contra 2% do contrato de
 * aprendizagem. "Encargos sobre as provisões" é o produto das duas alíquotas
 * (19,44% × 34,80% = 6,77%), não uma taxa própria.
 */
export function calcularCustoMensalEmpregador(
  salarioBase: number,
  competencia: Date,
  regime: RegimeEncargos = "celetista",
): CustoMensalEmpregador {
  const tabela = getLegalTable(competencia);
  const aliquotaFgts = regime === "aprendiz" ? FGTS_APRENDIZ : tabela.fgts.aliquota;

  const inssPatronal = arredondar(salarioBase * tabela.inssPatronal.aliquota);
  const rat = arredondar(salarioBase * RAT_EFETIVO);
  const terceiros = arredondar(salarioBase * TERCEIROS);
  const fgts = arredondar(salarioBase * aliquotaFgts);

  const provisaoDecimoTerceiro = arredondar(salarioBase * PROVISAO_DECIMO_TERCEIRO);
  const provisaoFerias = arredondar(salarioBase * PROVISAO_FERIAS);
  const provisaoTercoFerias = arredondar(salarioBase * PROVISAO_TERCO_FERIAS);

  const aliquotaEncargosDiretos = tabela.inssPatronal.aliquota + RAT_EFETIVO + TERCEIROS + aliquotaFgts;
  const aliquotaProvisoes = PROVISAO_DECIMO_TERCEIRO + PROVISAO_FERIAS + PROVISAO_TERCO_FERIAS;
  const aliquotaEncargosSobreProvisoes = aliquotaProvisoes * aliquotaEncargosDiretos;

  const encargosDiretos = arredondar(salarioBase * aliquotaEncargosDiretos);
  const provisoes = arredondar(salarioBase * aliquotaProvisoes);
  const encargosSobreProvisoes = arredondar(salarioBase * aliquotaEncargosSobreProvisoes);

  const total = arredondar(salarioBase + encargosDiretos + provisoes + encargosSobreProvisoes);

  const linhas: ComponenteCusto[] = [
    { label: "Salário", percentual: 1, valor: arredondar(salarioBase) },
    { label: "INSS Patronal", percentual: tabela.inssPatronal.aliquota, valor: inssPatronal },
    { label: "RAT (GIILRAT efetivo)", percentual: RAT_EFETIVO, valor: rat },
    { label: "Terceiros", percentual: TERCEIROS, valor: terceiros },
    {
      label: regime === "aprendiz" ? "FGTS (Aprendiz)" : "FGTS (Celetista)",
      percentual: aliquotaFgts,
      valor: fgts,
    },
    { label: "Provisão 13º", percentual: PROVISAO_DECIMO_TERCEIRO, valor: provisaoDecimoTerceiro },
    { label: "Provisão Férias", percentual: PROVISAO_FERIAS, valor: provisaoFerias },
    { label: "Provisão 1/3 Férias", percentual: PROVISAO_TERCO_FERIAS, valor: provisaoTercoFerias },
  ];

  return {
    salarioBase: arredondar(salarioBase),
    inssPatronal,
    rat,
    terceiros,
    fgts,
    provisaoDecimoTerceiro,
    provisaoFerias,
    provisaoTercoFerias,
    encargosDiretos,
    provisoes,
    encargosSobreProvisoes,
    total,
    aliquotaEncargosDiretos,
    aliquotaProvisoes,
    aliquotaEncargosSobreProvisoes,
    linhas,
    memoriaCalculo: [
      ...linhas.map((l) => ({ label: l.label, valor: l.valor })),
      { label: "Encargos diretos", valor: encargosDiretos },
      { label: "Provisões", valor: provisoes },
      { label: "Encargos sobre as provisões", valor: encargosSobreProvisoes },
      { label: "Custo Mensal Folha", valor: total },
    ],
  };
}
