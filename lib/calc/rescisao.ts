import { getLegalTable } from "../legal-tables";
import { calcularAvisoPrevio } from "./avisoPrevio";
import { calcularDecimoTerceiro } from "./decimoTerceiro";
import { calcularFerias } from "./ferias";
import { calcularFGTS } from "./fgts";
import { calcularINSS } from "./inss";
import { calcularIRRF } from "./irrf";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export type TipoRescisao =
  | "sem_justa_causa"
  | "pedido_demissao"
  | "justa_causa"
  | "acordo_484a"
  | "termino_contrato_determinado";

export interface RescisaoInput {
  tipo: TipoRescisao;
  salarioBase: number;
  dataAdmissao: Date;
  dataDesligamento: Date;
  /** Dias trabalhados no mês do desligamento (saldo de salário). */
  diasTrabalhadosNoMes: number;
  /** true = empresa paga o aviso indenizado; false = aviso cumprido em serviço (sem verba adicional). */
  avisoPrevioIndenizado: boolean;
  /** Dias de férias vencidas (período aquisitivo completo, não gozado). 0 se não houver. */
  feriasVencidasDias: number;
  /** Meses trabalhados no ano corrente até o desligamento, já considerando fração ≥15 dias = mês cheio. */
  mesesTrabalhadosNoAnoParaDecimoTerceiro: number;
  /** 13º já adiantado no ano, se houver. */
  decimoTerceiroAdiantado?: number;
  dependentes: number;
  /**
   * Saldo já depositado na conta do FGTS, usado para calcular a multa de 40%.
   * Se omitido, o sistema ESTIMA o FGTS do período (8% × salário × meses
   * trabalhados) — a estimativa NÃO substitui a consulta ao extrato real do
   * FGTS Digital, que deve ser conferida antes do pagamento.
   */
  saldoFgtsDepositado?: number;
}

export interface DetalheRescisao {
  saldoSalario: number;
  avisoPrevioDias: number;
  avisoPrevioValor: number;
  decimoTerceiroProporcional: number;
  feriasVencidas: number;
  feriasProporcionais: number;
  baseFgtsMulta: number;
  fgtsEstimado: boolean;
  multaFgts: number;
  inssTotal: number;
  irrfTotal: number;
  totalProventos: number;
  totalDescontos: number;
  observacoes: string[];
}

function mesesEntre(inicio: Date, fim: Date): number {
  const meses =
    (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
  return Math.max(0, fim.getDate() >= inicio.getDate() ? meses : meses - 1);
}

/**
 * Calcula as verbas rescisórias compondo os cálculos de saldo de salário,
 * aviso prévio, 13º proporcional, férias e multa de FGTS, conforme o tipo de
 * rescisão. Regras de fronteira (ex.: justa causa e perda de proporcionais)
 * seguem o entendimento predominante e são sinalizadas em `observacoes` —
 * casos concretos com convenção coletiva específica devem ser revisados por
 * um especialista.
 */
export function calcularRescisao(input: RescisaoInput): CalculoResult<DetalheRescisao> {
  const {
    tipo,
    salarioBase,
    dataAdmissao,
    dataDesligamento,
    diasTrabalhadosNoMes,
    avisoPrevioIndenizado,
    feriasVencidasDias,
    mesesTrabalhadosNoAnoParaDecimoTerceiro,
    decimoTerceiroAdiantado = 0,
    dependentes,
    saldoFgtsDepositado,
  } = input;

  const tabela = getLegalTable(dataDesligamento);
  const memoriaCalculo: MemoriaCalculoStep[] = [];
  const observacoes: string[] = [];

  const mesesTrabalhadosTotal = mesesEntre(dataAdmissao, dataDesligamento);

  // 1. Saldo de salário
  const saldoSalario = arredondar((salarioBase / 30) * diasTrabalhadosNoMes);
  memoriaCalculo.push({
    label: `Saldo de salário (${diasTrabalhadosNoMes} dias)`,
    formula: `R$ ${salarioBase.toFixed(2)} ÷ 30 × ${diasTrabalhadosNoMes}`,
    valor: saldoSalario,
  });

  // 2. Aviso prévio
  let avisoPrevioDias = 0;
  let avisoPrevioValor = 0;
  if (tipo === "sem_justa_causa" && avisoPrevioIndenizado) {
    avisoPrevioDias = calcularAvisoPrevio(mesesTrabalhadosTotal).dias;
    avisoPrevioValor = arredondar((salarioBase / 30) * avisoPrevioDias);
    memoriaCalculo.push({
      label: `Aviso prévio indenizado (${avisoPrevioDias} dias)`,
      valor: avisoPrevioValor,
    });
  } else if (tipo === "acordo_484a" && avisoPrevioIndenizado) {
    avisoPrevioDias = Math.round(calcularAvisoPrevio(mesesTrabalhadosTotal).dias / 2);
    avisoPrevioValor = arredondar((salarioBase / 30) * avisoPrevioDias);
    memoriaCalculo.push({
      label: `Aviso prévio indenizado — metade (Art. 484-A CLT, ${avisoPrevioDias} dias)`,
      valor: avisoPrevioValor,
    });
  } else if (tipo === "sem_justa_causa" || tipo === "acordo_484a") {
    observacoes.push(
      "Aviso prévio cumprido em serviço — sem verba adicional neste cálculo; confirme o último dia efetivamente trabalhado.",
    );
  } else if (tipo === "pedido_demissao") {
    observacoes.push(
      "Pedido de demissão: aviso prévio é devido pelo empregado à empresa (30 dias) — não gera verba a receber; se não cumprido, a empresa pode descontar do valor rescisório.",
    );
  } else if (tipo === "justa_causa") {
    observacoes.push("Dispensa por justa causa: não há aviso prévio devido em nenhuma direção.");
  }

  // 3. 13º proporcional (não devido em justa causa, segundo entendimento predominante)
  let decimoTerceiroProporcional = 0;
  if (tipo !== "justa_causa") {
    const resultado13 = calcularDecimoTerceiro(
      salarioBase,
      mesesTrabalhadosNoAnoParaDecimoTerceiro,
      dependentes,
      decimoTerceiroAdiantado,
      dataDesligamento,
    );
    decimoTerceiroProporcional = resultado13.valor;
    memoriaCalculo.push({ label: "13º salário proporcional (líquido)", valor: decimoTerceiroProporcional });
  } else {
    observacoes.push(
      "Justa causa: 13º proporcional NÃO incluído neste cálculo, conforme entendimento predominante — há divergência doutrinária/jurisprudencial; confirme com um especialista antes de excluir a verba.",
    );
  }

  // 4. Férias vencidas (sempre devidas, mesmo em justa causa) e proporcionais
  let feriasVencidas = 0;
  if (feriasVencidasDias > 0) {
    const resultadoVencidas = calcularFerias({
      salarioBase,
      diasDireito: 30,
      diasGozados: feriasVencidasDias,
      abonoPecuniario: false,
      dependentes,
      competencia: dataDesligamento,
    });
    feriasVencidas = resultadoVencidas.valor;
    memoriaCalculo.push({ label: "Férias vencidas + 1/3 (líquido)", valor: feriasVencidas });
  }

  let feriasProporcionais = 0;
  if (tipo !== "justa_causa") {
    const diasProporcionais = arredondar(
      (mesesTrabalhadosNoAnoParaDecimoTerceiro / 12) * 30,
    );
    const resultadoProporcionais = calcularFerias({
      salarioBase,
      diasDireito: 30,
      diasGozados: diasProporcionais,
      abonoPecuniario: false,
      dependentes,
      competencia: dataDesligamento,
    });
    feriasProporcionais = resultadoProporcionais.valor;
    memoriaCalculo.push({
      label: `Férias proporcionais + 1/3 (${diasProporcionais.toFixed(1)} dias, líquido)`,
      valor: feriasProporcionais,
    });
  } else {
    observacoes.push(
      "Justa causa: férias proporcionais NÃO incluídas neste cálculo (Art. 146, parágrafo único CLT) — confirme o entendimento aplicável ao caso.",
    );
  }

  // 5. Multa de FGTS (40% sem justa causa / 20% no acordo Art. 484-A)
  let fgtsEstimado = false;
  let baseFgtsMulta = saldoFgtsDepositado ?? 0;
  if (saldoFgtsDepositado === undefined) {
    fgtsEstimado = true;
    baseFgtsMulta = arredondar(
      calcularFGTS(salarioBase, dataDesligamento).valor * mesesTrabalhadosTotal,
    );
    observacoes.push(
      "Saldo de FGTS não informado — a base da multa foi ESTIMADA (8% × salário × meses trabalhados) e NÃO reflete correção monetária, rendimentos ou depósitos reais. Confira o extrato do FGTS Digital antes de pagar.",
    );
  }

  let multaFgts = 0;
  if (tipo === "sem_justa_causa") {
    multaFgts = arredondar(baseFgtsMulta * tabela.fgts.multaRescisoria);
    memoriaCalculo.push({
      label: `Multa de ${(tabela.fgts.multaRescisoria * 100).toFixed(0)}% sobre o FGTS`,
      formula: `R$ ${baseFgtsMulta.toFixed(2)} × ${(tabela.fgts.multaRescisoria * 100).toFixed(0)}%`,
      valor: multaFgts,
    });
  } else if (tipo === "acordo_484a") {
    multaFgts = arredondar(baseFgtsMulta * (tabela.fgts.multaRescisoria / 2));
    memoriaCalculo.push({
      label: `Multa de ${((tabela.fgts.multaRescisoria / 2) * 100).toFixed(0)}% sobre o FGTS (Art. 484-A CLT)`,
      valor: multaFgts,
    });
  }

  // 6. INSS/IRRF sobre saldo de salário (as demais verbas já vêm líquidas dos seus próprios cálculos)
  const inssSaldo = calcularINSS(saldoSalario, dataDesligamento);
  const irrfSaldo = calcularIRRF(saldoSalario - inssSaldo.valor, dependentes, dataDesligamento);
  memoriaCalculo.push({ label: "INSS sobre o saldo de salário", valor: inssSaldo.valor });
  memoriaCalculo.push({ label: "IRRF sobre o saldo de salário", valor: irrfSaldo.valor });

  const totalProventos = arredondar(
    saldoSalario +
      avisoPrevioValor +
      decimoTerceiroProporcional +
      feriasVencidas +
      feriasProporcionais +
      multaFgts,
  );
  const totalDescontos = arredondar(inssSaldo.valor + irrfSaldo.valor);
  const valor = arredondar(totalProventos - totalDescontos);

  memoriaCalculo.push({ label: "Total de proventos", valor: totalProventos });
  memoriaCalculo.push({ label: "Total de descontos (INSS + IRRF sobre saldo)", valor: totalDescontos });
  memoriaCalculo.push({ label: "Valor líquido da rescisão", valor });

  observacoes.push(
    "Prazo legal de pagamento das verbas rescisórias: até 10 dias corridos contados do término do contrato (Art. 477, §6º CLT).",
  );

  return {
    valor,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      saldoSalario,
      avisoPrevioDias,
      avisoPrevioValor,
      decimoTerceiroProporcional,
      feriasVencidas,
      feriasProporcionais,
      baseFgtsMulta,
      fgtsEstimado,
      multaFgts,
      inssTotal: inssSaldo.valor,
      irrfTotal: irrfSaldo.valor,
      totalProventos,
      totalDescontos,
      observacoes,
    },
  };
}
