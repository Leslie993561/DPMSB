import { getLegalTable } from "../legal-tables";
import { calcularINSS } from "./inss";
import { calcularIRRF } from "./irrf";
import { calcularAdicionais } from "./adicionais";
import { arredondar, type CalculoResult, type MemoriaCalculoStep } from "./types";

export interface FeriasInput {
  salarioBase: number;
  /** Dias de direito no período aquisitivo (até 30). */
  diasDireito: number;
  /** Dias efetivamente gozados/pagos neste evento. */
  diasGozados: number;
  /** Venda de 1/3 do período de direito (Art. 143 CLT). */
  abonoPecuniario: boolean;
  dependentes: number;
  competencia: Date;
  /**
   * Dias de gozo que caem fora do período concessivo e por isso são pagos em
   * dobro (Art. 137 CLT). Use `avaliarPrazoConcessao().diasEmDobro`; aqui não
   * é inferido, para o chamador dizer explicitamente que está pagando em
   * atraso. Zero (o default) = férias no prazo.
   */
  diasEmDobro?: number;
  /**
   * Médias e vantagens que integram a remuneração de férias (Art. 142 §5º CLT).
   *
   * A remuneração de férias não é o salário base: é o salário mais o que o
   * empregado recebia com habitualidade. O aviso de férias do DP separa
   * exatamente estas parcelas, e sem elas o portal pagava menos — no caso do
   * Iago, R$ 2.162,50 contra os R$ 2.844,21 do aviso, porque faltavam a média
   * de horas e o adicional de 30% que ele recebe todo mês.
   *
   * Ausentes (o default) valem zero: a base fica sendo só o salário, que é o
   * certo para quem não tem adicional nem hora extra habitual.
   */
  mediaHoras?: number;
  mediaValores?: number;
  outrasVantagens?: number;
}

export interface DetalheFerias {
  /** Salário + médias + vantagens: a remuneração de férias do Art. 142 §5º. */
  baseDeCalculo: number;
  valorGozado: number;
  tercoConstitucional: number;
  diasVendidos: number;
  abono: number;
  tercoAbono: number;
  /**
   * Acréscimo do Art. 137 (a "segunda" remuneração), zero quando as férias
   * saem no prazo. Fica em campo próprio, e não somado a `valorGozado`, para a
   * multa aparecer destacada no relatório em vez de virar férias comum.
   */
  dobra: number;
  inss: number;
  irrf: number;
  valorLiquido: number;
}

/**
 * Férias gozadas + 1/3 constitucional (tributáveis por INSS/IRRF) e, se houver,
 * abono pecuniário + seu 1/3 (natureza indenizatória, não tributável).
 */
export function calcularFerias(input: FeriasInput): CalculoResult<DetalheFerias> {
  const { salarioBase, diasDireito, diasGozados, abonoPecuniario, dependentes, competencia } = input;
  const diasEmDobro = Math.min(diasGozados, Math.max(0, input.diasEmDobro ?? 0));
  const tabela = getLegalTable(competencia);

  const mediaHoras = input.mediaHoras ?? 0;
  const mediaValores = input.mediaValores ?? 0;
  const outrasVantagens = input.outrasVantagens ?? 0;
  const baseDeCalculo = salarioBase + mediaHoras + mediaValores + outrasVantagens;

  const valorDiario = baseDeCalculo / 30;
  const valorGozado = arredondar(valorDiario * diasGozados);
  const tercoConstitucional = arredondar(valorGozado / 3);

  // A memória repete a ordem do aviso de férias do DP para poder ser conferida
  // linha por linha contra o documento.
  const memoriaCalculo: MemoriaCalculoStep[] = [
    { label: "Salário base", valor: arredondar(salarioBase) },
    ...(mediaHoras ? [{ label: "Média de horas (Art. 142 §5º CLT)", valor: arredondar(mediaHoras) }] : []),
    ...(mediaValores ? [{ label: "Média de valores (Art. 142 §5º CLT)", valor: arredondar(mediaValores) }] : []),
    ...(outrasVantagens ? [{ label: "Outras vantagens (adicionais habituais)", valor: arredondar(outrasVantagens) }] : []),
    { label: "TOTAL BASE DE CÁLCULO", valor: arredondar(baseDeCalculo) },
    { label: "Valor do dia de férias", formula: `R$ ${baseDeCalculo.toFixed(2)} ÷ 30`, valor: arredondar(valorDiario) },
    { label: `Férias gozadas (${diasGozados} dias)`, valor: valorGozado },
    { label: "1/3 constitucional (Art. 7º, XVII CF)", formula: "valor gozado ÷ 3", valor: tercoConstitucional },
  ];

  let diasVendidos = 0;
  let abono = 0;
  let tercoAbono = 0;
  if (abonoPecuniario) {
    diasVendidos = arredondar(diasDireito / 3);
    abono = arredondar(valorDiario * diasVendidos);
    tercoAbono = arredondar(abono / 3);
    memoriaCalculo.push({
      label: `Abono pecuniário (venda de ${diasVendidos} dias)`,
      valor: abono,
    });
    memoriaCalculo.push({ label: "1/3 sobre o abono", valor: tercoAbono });
  }

  // Art. 137 CLT: os dias concedidos fora do período concessivo são pagos em
  // dobro. Dobra-se a remuneração desses dias (valor do dia + 1/3); o abono
  // pecuniário não entra, por ser indenização de natureza distinta (Art. 143).
  let dobra = 0;
  if (diasEmDobro > 0) {
    const remuneracaoAtrasada = arredondar(valorDiario * diasEmDobro);
    dobra = arredondar(remuneracaoAtrasada + remuneracaoAtrasada / 3);
    memoriaCalculo.push({
      label: `Dobra de ${diasEmDobro} dia(s) fora do prazo (Art. 137 CLT)`,
      formula: "remuneração dos dias em atraso + 1/3",
      valor: dobra,
    });
  }

  // A dobra fica FORA da base de INSS/IRRF: é penalidade ao empregador, de
  // natureza indenizatória, não contraprestação de trabalho. O tratamento
  // tributário do acréscimo é controverso — se a contabilidade da empresa
  // entender que incide, o valor está destacado em `detalhe.dobra` para ser
  // reprocessado sem precisar recalcular o resto.
  const baseTributavel = arredondar(valorGozado + tercoConstitucional);
  const inss = calcularINSS(baseTributavel, competencia);
  memoriaCalculo.push({ label: "INSS sobre férias + 1/3 (abono e dobra não entram na base)", valor: inss.valor });

  const irrf = calcularIRRF(baseTributavel - inss.valor, dependentes, competencia);
  memoriaCalculo.push({ label: "IRRF sobre férias + 1/3", valor: irrf.valor });

  const valorLiquido = arredondar(
    valorGozado + tercoConstitucional + abono + tercoAbono + dobra - inss.valor - irrf.valor,
  );
  memoriaCalculo.push({ label: "Valor líquido a receber", valor: valorLiquido });

  return {
    valor: valorLiquido,
    memoriaCalculo,
    tabelaLegalVersao: tabela.fonte,
    detalhe: {
      baseDeCalculo: arredondar(baseDeCalculo),
      valorGozado,
      tercoConstitucional,
      diasVendidos,
      abono,
      tercoAbono,
      dobra,
      inss: inss.valor,
      irrf: irrf.valor,
      valorLiquido,
    },
  };
}

export interface PrazoConcessaoFerias {
  vencida: boolean;
  diasAtraso: number;
  /** Fim do período concessivo: 12 meses após o fim do aquisitivo (Art. 134 CLT). */
  limiteConcessao: string;
  /**
   * Última data em que as férias ainda podem COMEÇAR e terminar dentro do
   * período concessivo — é a coluna "Limite p/ gozo" do relatório de
   * Programação de Férias, e depende de quantos dias serão gozados.
   */
  limiteInicio: string;
  /**
   * Dias de gozo que caem depois do fim do concessivo. É a base da dobra do
   * Art. 137: se as férias começam dentro do prazo e "vazam" para fora, só o
   * excedente é pago em dobro; se começam já fora, todos os dias entram.
   */
  diasEmDobro: number;
}

/**
 * O período concessivo de férias vai até 12 meses após o fim do período
 * aquisitivo (Art. 134 CLT). As férias precisam CABER dentro dele — por isso o
 * limite para iniciar o gozo recua conforme o número de dias a gozar. Dias
 * concedidos além desse prazo são pagos em dobro (Art. 137 CLT).
 *
 * `diasGozados` tem default 1 para quem só quer saber o fim do concessivo.
 */
export function avaliarPrazoConcessao(
  periodoAquisitivoFim: Date,
  dataConcessao: Date,
  diasGozados = 1,
): PrazoConcessaoFerias {
  const limite = new Date(periodoAquisitivoFim);
  limite.setMonth(limite.getMonth() + 12);

  const dias = Math.max(1, Math.round(diasGozados));
  const limiteInicio = new Date(limite);
  limiteInicio.setDate(limiteInicio.getDate() - (dias - 1));

  const diasAtraso = Math.max(
    0,
    Math.floor((dataConcessao.getTime() - limiteInicio.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    vencida: diasAtraso > 0,
    diasAtraso,
    limiteConcessao: limite.toISOString().slice(0, 10),
    limiteInicio: limiteInicio.toISOString().slice(0, 10),
    diasEmDobro: Math.min(dias, diasAtraso),
  };
}

/** O que o cálculo precisa saber do cadastro para montar a base das férias. */
export interface VantagensDoColaborador {
  salarioBase: number;
  periculosidadePercentual: number | null;
  insalubridadePercentual: number | null;
  adicionalFixo: number | null;
}

/**
 * Adicionais habituais que integram a remuneração de férias (Art. 142 §5º CLT).
 *
 * Periculosidade, insalubridade e adicional fixo são pagos todo mês, então
 * entram na base das férias — o aviso de férias do DP os traz somados em
 * "Outras Vantagens". Sem isto o portal calculava férias sobre o salário nu e
 * pagava menos a quem tem adicional.
 */
export function outrasVantagensDeFerias(c: VantagensDoColaborador, competencia: Date): number {
  const adicionais = calcularAdicionais(
    {
      salarioBase: c.salarioBase,
      periculosidadePercentual: c.periculosidadePercentual,
      insalubridadePercentual: c.insalubridadePercentual,
      adicionalFixo: c.adicionalFixo,
    },
    competencia,
  );
  return arredondar(adicionais.total);
}
