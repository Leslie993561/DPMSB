import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  calcularAvisoPrevio,
  calcularDecimoTerceiro,
  calcularFerias,
  calcularFGTS,
  calcularHorasExtras,
  calcularINSS,
  calcularIRRF,
  calcularRescisao,
} from "@/lib/calc";

const competenciaSchema = z.iso.date().describe("Data ISO da competência, ex: 2025-06-01");

const schemas = {
  calcular_inss: z.object({
    salarioBruto: z.number().positive(),
    competencia: competenciaSchema,
  }),
  calcular_irrf: z.object({
    rendimentoTributavel: z.number().min(0).describe("Rendimento já líquido de INSS"),
    dependentes: z.number().min(0).default(0),
    competencia: competenciaSchema,
    pensaoAlimenticia: z.number().min(0).optional(),
  }),
  calcular_fgts: z.object({
    salarioBase: z.number().positive(),
    competencia: competenciaSchema,
  }),
  calcular_aviso_previo: z.object({
    mesesTrabalhados: z.number().min(0).describe("Meses completos de tempo de serviço"),
  }),
  calcular_decimo_terceiro: z.object({
    salarioBase: z.number().positive(),
    mesesTrabalhadosNoAno: z.number().min(0).max(12),
    dependentes: z.number().min(0).default(0),
    adiantamentoRecebido: z.number().min(0).default(0),
    competencia: competenciaSchema,
  }),
  calcular_ferias: z.object({
    salarioBase: z.number().positive(),
    diasDireito: z.number().min(1).max(30),
    diasGozados: z.number().min(1).max(30),
    abonoPecuniario: z.boolean().default(false),
    dependentes: z.number().min(0).default(0),
    competencia: competenciaSchema,
  }),
  calcular_horas_extras: z.object({
    salarioBase: z.number().positive(),
    horasMensais: z.number().positive(),
    horasExtras: z.number().min(0),
    percentualAdicional: z.number().min(0).describe("0.5 para 50%, 1.0 para dobro"),
    incluirDSR: z.boolean().default(false),
    diasUteisMes: z.number().positive().optional(),
    diasRepousoMes: z.number().positive().optional(),
  }),
  calcular_rescisao: z.object({
    tipo: z.enum([
      "sem_justa_causa",
      "pedido_demissao",
      "justa_causa",
      "acordo_484a",
      "termino_contrato_determinado",
    ]),
    salarioBase: z.number().positive(),
    dataAdmissao: z.iso.date(),
    dataDesligamento: z.iso.date(),
    diasTrabalhadosNoMes: z.number().min(0).max(31),
    avisoPrevioIndenizado: z.boolean(),
    feriasVencidasDias: z.number().min(0).max(30).default(0),
    mesesTrabalhadosNoAnoParaDecimoTerceiro: z.number().min(0).max(12),
    decimoTerceiroAdiantado: z.number().min(0).default(0),
    dependentes: z.number().min(0).default(0),
    saldoFgtsDepositado: z.number().min(0).optional(),
  }),
} as const;

const descriptions: Record<keyof typeof schemas, string> = {
  calcular_inss:
    "Calcula a contribuição previdenciária (INSS) do empregado de forma progressiva por faixas, respeitando o teto de contribuição. Use sempre que precisar do valor de INSS sobre um rendimento.",
  calcular_irrf:
    "Calcula o IRRF retido na fonte sobre um rendimento já líquido de INSS, aplicando dedução por dependente e pensão alimentícia. Use sempre que precisar do valor de IRRF.",
  calcular_fgts: "Calcula o depósito de FGTS (8% sobre a remuneração) devido no mês.",
  calcular_aviso_previo:
    "Calcula os dias de aviso prévio proporcional ao tempo de serviço (Lei 12.506/2011): 30 dias base + 3 dias por ano completo, limitado a 90 dias.",
  calcular_decimo_terceiro:
    "Calcula o 13º salário proporcional (bruto, INSS, IRRF e líquido), descontando adiantamento já recebido.",
  calcular_ferias:
    "Calcula férias gozadas + 1/3 constitucional e, se houver, abono pecuniário (venda de até 1/3), com INSS e IRRF sobre a parte tributável.",
  calcular_horas_extras:
    "Calcula o valor de horas extras com adicional e, opcionalmente, o reflexo estimado no DSR.",
  calcular_rescisao:
    "Calcula todas as verbas rescisórias (saldo de salário, aviso prévio, 13º proporcional, férias vencidas/proporcionais, multa de FGTS) conforme o tipo de rescisão. Use SEMPRE que o usuário pedir um cálculo de rescisão/demissão — nunca estime manualmente.",
};

export const tools: Anthropic.Tool[] = (Object.keys(schemas) as (keyof typeof schemas)[]).map((name) => ({
  name,
  description: descriptions[name],
  input_schema: z.toJSONSchema(schemas[name]) as Anthropic.Tool.InputSchema,
}));

function toDate(iso: string): Date {
  return new Date(iso);
}

export const toolDispatch: Record<string, (input: unknown) => unknown> = {
  calcular_inss: (input) => {
    const p = schemas.calcular_inss.parse(input);
    return calcularINSS(p.salarioBruto, toDate(p.competencia));
  },
  calcular_irrf: (input) => {
    const p = schemas.calcular_irrf.parse(input);
    return calcularIRRF(p.rendimentoTributavel, p.dependentes, toDate(p.competencia), p.pensaoAlimenticia);
  },
  calcular_fgts: (input) => {
    const p = schemas.calcular_fgts.parse(input);
    return calcularFGTS(p.salarioBase, toDate(p.competencia));
  },
  calcular_aviso_previo: (input) => {
    const p = schemas.calcular_aviso_previo.parse(input);
    return calcularAvisoPrevio(p.mesesTrabalhados);
  },
  calcular_decimo_terceiro: (input) => {
    const p = schemas.calcular_decimo_terceiro.parse(input);
    return calcularDecimoTerceiro(
      p.salarioBase,
      p.mesesTrabalhadosNoAno,
      p.dependentes,
      p.adiantamentoRecebido,
      toDate(p.competencia),
    );
  },
  calcular_ferias: (input) => {
    const p = schemas.calcular_ferias.parse(input);
    return calcularFerias({ ...p, competencia: toDate(p.competencia) });
  },
  calcular_horas_extras: (input) => {
    const p = schemas.calcular_horas_extras.parse(input);
    return calcularHorasExtras(p);
  },
  calcular_rescisao: (input) => {
    const p = schemas.calcular_rescisao.parse(input);
    return calcularRescisao({
      ...p,
      dataAdmissao: toDate(p.dataAdmissao),
      dataDesligamento: toDate(p.dataDesligamento),
    });
  },
};
