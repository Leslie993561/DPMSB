import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

/**
 * Tarifa de ônibus (ida ou volta) por cidade — dado municipal/operacional,
 * não uma tabela legal federal. Usada apenas como PALPITE inicial quando o
 * colaborador ainda não tem um valor de VT próprio cadastrado; o valor
 * informado no cadastro (por dia útil) sempre prevalece sobre esta tabela.
 */
export const TARIFA_VT_POR_CIDADE: Record<string, number> = {
  "Lauro de Freitas": 10.4,
  Salvador: 11.9,
  Camaçari: 18,
  "Simões Filho": 10.4,
};

/** Percentual máximo que pode ser descontado do salário do empregado (Lei 7.418/85, art. 4º, c/c Decreto 95.247/87). */
const PERCENTUAL_MAXIMO_DESCONTO = 0.06;

/** Normaliza (maiúsculas, sem acento, sem espaço nas pontas) para casar "CAMACARI"/"Camaçari"/"camaçari" com a mesma chave. */
function normalizarCidade(cidade: string): string {
  return cidade
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

const TARIFA_VT_POR_CIDADE_NORMALIZADA: Record<string, number> = Object.fromEntries(
  Object.entries(TARIFA_VT_POR_CIDADE).map(([cidade, tarifa]) => [normalizarCidade(cidade), tarifa]),
);

/** Tarifa-padrão da cidade (placeholder) — só usada quando o colaborador não tem valor de VT próprio cadastrado. */
export function tarifaVtPorCidade(cidade: string): number {
  return TARIFA_VT_POR_CIDADE_NORMALIZADA[normalizarCidade(cidade)] ?? 0;
}

export interface DetalheValeTransporte {
  tarifaUnitaria: number;
  diasUteis: number;
  valorBruto: number;
  descontoEmpregado: number;
  custoEmpresa: number;
}

/**
 * Custo do vale-transporte: 2 trechos (ida/volta) × tarifa por dia útil ×
 * dias úteis no mês, menos o desconto do empregado (até 6% do salário base —
 * Lei 7.418/85). O custo para a empresa é sempre o valor bruto menos esse
 * desconto — nunca um número arbitrado à mão. `tarifaUnitaria` é o valor de
 * UM trecho (ida OU volta) num dia útil, tipicamente o valor de VT cadastrado
 * para o colaborador.
 */
export function calcularValeTransporte(
  tarifaUnitaria: number,
  salarioBase: number,
  diasUteis: number,
): CalculoResult<DetalheValeTransporte> {
  const valorBruto = arredondar(tarifaUnitaria * 2 * diasUteis);
  const descontoEmpregado = arredondar(Math.min(salarioBase * PERCENTUAL_MAXIMO_DESCONTO, valorBruto));
  const custoEmpresa = arredondar(valorBruto - descontoEmpregado);

  const memoriaCalculo: MemoriaCalculoStep[] = [
    {
      label: "Vale-transporte bruto",
      formula: `R$ ${tarifaUnitaria.toFixed(2)} × 2 trechos × ${diasUteis} dias úteis`,
      valor: valorBruto,
    },
    {
      label: "Desconto do empregado (até 6% do salário, Lei 7.418/85)",
      formula: `mín(R$ ${salarioBase.toFixed(2)} × 6%, valor bruto)`,
      valor: descontoEmpregado,
    },
    { label: "Custo líquido para a empresa", valor: custoEmpresa },
  ];

  return {
    valor: custoEmpresa,
    memoriaCalculo,
    tabelaLegalVersao: "Lei 7.418/85 (desconto do empregado)",
    detalhe: { tarifaUnitaria, diasUteis, valorBruto, descontoEmpregado, custoEmpresa },
  };
}

/**
 * Acima disto, um "valor por dia útil" quase certamente é um valor MENSAL
 * digitado na coluna errada.
 *
 * As passagens reais da empresa vão de R$ 10,40 a R$ 20,80 por dia. A Rebeca
 * estava com R$ 378,00 por dia — o valor mensal do vale-mobilidade dela — e
 * isso sozinho somava R$ 7.938 ao VT do mês sem nada na tela indicando erro.
 * O portal não corrige: aponta.
 */
export const VT_DIARIO_IMPLAUSIVEL = 100;

/** O que o cálculo de transporte precisa saber do cadastro. */
export interface TransporteDoColaborador {
  tipoTransporte: string;
  /** Vale mobilidade: valor fixo do mês, não multiplica por dias úteis. */
  valorTransporteFixo: number | null;
  /** Vale transporte: valor de UM dia útil, ida e volta somadas. */
  valorTransporteDia: number | null;
  cidade: string | null;
  salarioBase: number;
}

/**
 * Custo mensal de transporte do colaborador, seja VT ou VM.
 *
 * Existe para que o Rateio de benefícios e o Breakdown de folha respondam o
 * mesmo número: os dois repetiam esta escolha e qualquer ajuste precisava ser
 * feito duas vezes.
 *
 * VM é um valor fixo do mês — não se multiplica por dia útil nem se desconta do
 * empregado. VT é valor do dia × dias úteis, menos o desconto de até 6% da Lei
 * 7.418/85. Sem valor de dia cadastrado cai na tarifa da cidade, que é por
 * trecho e por isso vai dobrada.
 */
export function calcularTransporteDoMes(c: TransporteDoColaborador, diasUteis: number): number {
  return detalharTransporteDoMes(c, diasUteis).custoEmpresa;
}

/** De onde veio o valor do dia usado no cálculo do VT. */
export type OrigemTransporte = "cadastro" | "sem-valor" | "vm-fixo";

/**
 * Mesmo cálculo, dizendo também de onde saiu o número.
 *
 * Sem isso, VT calculado pela tarifa da cidade era indistinguível de VT
 * calculado pelo valor cadastrado: alterar o cadastro não mudava a tela e não
 * havia como saber por quê. A origem sobe até o Rateio para que se veja quem
 * está sem valor cadastrado em vez de ficar procurando.
 */
export interface DetalheTransporteDoMes {
  /** Valor do vale que a empresa compra da operadora: valor do dia × dias úteis. */
  bruto: number;
  /** Parte do empregado, descontada em folha — até 6% do salário (Lei 7.418/85). */
  descontoEmpregado: number;
  /** O que sobra para a empresa depois do desconto. */
  custoEmpresa: number;
  origem: OrigemTransporte;
}

/**
 * Mesmo cálculo, aberto em bruto, desconto e custo líquido.
 *
 * Os dois números têm usos diferentes e confundi-los faz o portal nunca fechar
 * com a operadora: o Rateio de Benefícios mostra o BRUTO, que é o valor do
 * vale e o que aparece na fatura; o Breakdown de Folha mostra o CUSTO
 * LÍQUIDO, que é o que a empresa desembolsa depois do desconto em folha.
 *
 * A origem também sobe até a tela: sem ela, VT calculado pela tarifa da cidade
 * era indistinguível de VT vindo do cadastro, e alterar o colaborador não
 * mudava nada sem que houvesse como saber por quê.
 */
export function detalharTransporteDoMes(c: TransporteDoColaborador, diasUteis: number): DetalheTransporteDoMes {
  // Vale mobilidade não sofre o desconto do VT: não é vale-transporte, é
  // auxílio, e a Lei 7.418/85 não alcança.
  //
  // Aceita as duas formas de cadastro. Com valor POR DIA, o mês é dia × dias
  // úteis — é assim que o DP raciocina ("o Iago recebe 18 por dia"), e é o que
  // permite abater férias em dias em vez de em fração. Com valor FIXO mensal,
  // o valor é o do mês; quem chama abate as férias em cima, proporcionalmente.
  if (c.tipoTransporte === "vm_fixo") {
    if (c.valorTransporteDia !== null && c.valorTransporteDia > 0) {
      const mensal = arredondar(c.valorTransporteDia * diasUteis);
      return { bruto: mensal, descontoEmpregado: 0, custoEmpresa: mensal, origem: "vm-fixo" };
    }
    const fixo = c.valorTransporteFixo ?? 0;
    return { bruto: fixo, descontoEmpregado: 0, custoEmpresa: fixo, origem: "vm-fixo" };
  }

  // Sem valor cadastrado, o VT é ZERO. Havia um recurso à tarifa média da
  // cidade, e ele arbitrava folha: a Tainara aparecia com R$ 208,00 no rateio
  // com o campo vazio no Quadro, e nada na linha dizia que aquele número não
  // vinha do cadastro dela. Quem está sem valor fica em zero, e o aviso da
  // tela cobra o preenchimento.
  //
  // O valor cadastrado é o do dia inteiro (ida + volta), como o DP informa,
  // enquanto calcularValeTransporte espera o de um trecho — daí a divisão por 2.
  const valorDia = c.valorTransporteDia;
  if (valorDia === null || valorDia <= 0) {
    return { bruto: 0, descontoEmpregado: 0, custoEmpresa: 0, origem: "sem-valor" };
  }

  const { detalhe } = calcularValeTransporte(valorDia / 2, c.salarioBase, diasUteis);
  return {
    bruto: detalhe.valorBruto,
    descontoEmpregado: detalhe.descontoEmpregado,
    custoEmpresa: detalhe.custoEmpresa,
    origem: "cadastro",
  };
}
