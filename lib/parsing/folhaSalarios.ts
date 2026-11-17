import "server-only";
import { casarPorNome } from "@/lib/folha/casarNome";
import { getLegalTable } from "@/lib/legal-tables";
import type { FuncionarioLiquido } from "./pdfReciboPagamento";
import {
  percentualPadrao,
  resumirProventos,
  PERCENTUAIS_INSALUBRIDADE,
  PERCENTUAIS_PERICULOSIDADE,
  type HoleriteLido,
} from "./reciboEventos";

export interface ColaboradorParaCasar {
  id: number;
  nome: string;
  cpf: string | null;
  salarioBase: number;
  periculosidadePercentual: number | null;
  insalubridadePercentual: number | null;
}

export interface HorasExtrasDoMes {
  horaExtra50: number | null;
  horaExtra100: number | null;
}

export interface LinhaComparacaoRecibo {
  colaboradorId: number;
  nome: string;
  salarioAtual: number;
  salarioNovo: number;
  /**
   * Periculosidade e insalubridade em PERCENTUAL, como o cadastro guarda. `nova`
   * é null quando o recibo não traz o evento — nesse caso o cadastro não é
   * mexido (a ausência pode ser férias ou afastamento, não perda do adicional).
   */
  periculosidadeAtual: number | null;
  periculosidadeNova: number | null;
  insalubridadeAtual: number | null;
  insalubridadeNova: number | null;
  /** Horas decimais da competência do recibo; o recibo é a fonte do mês, então ausência = 0. */
  horaExtra50Atual: number;
  horaExtra50Nova: number;
  horaExtra100Atual: number;
  horaExtra100Nova: number;
  mudouSalario: boolean;
  mudouAdicionais: boolean;
  mudouHoras: boolean;
  mudou: boolean;
  /** Pontos de atenção que o DP deve conferir antes de gravar. */
  avisos: string[];
}

export interface ResultadoComparacaoRecibo {
  linhas: LinhaComparacaoRecibo[];
  descartados: { codigo: string; nome: string; motivo: string }[];
}

function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

const mudou = (a: number | null, b: number | null, tolerancia: number) => Math.abs((a ?? 0) - (b ?? 0)) >= tolerancia;

function salarioMinimoDa(competencia: string | null): number {
  const [ano, mes] = competencia ? competencia.split("-").map(Number) : [];
  const data = ano && mes ? new Date(ano, mes - 1, 1) : new Date();
  return getLegalTable(data).salarioMinimo;
}

/**
 * Casa cada funcionário do Recibo de Pagamento com um colaborador do cadastro —
 * pelo CPF (via Relatório de Líquidos, que é quem traz o CPF) e, faltando CPF
 * (ex.: mês inteiro afastado, fora do relatório de líquidos), pelo nome — e
 * compara o que o recibo traz com o cadastro: Salário Base, adicionais de
 * periculosidade/insalubridade e horas extras do mês. INSS/FGTS/IRRF não entram
 * aqui: são calculados a partir do salário base, não importados.
 */
export function compararRecibos(
  holerites: HoleriteLido[],
  liquidos: FuncionarioLiquido[],
  colaboradores: ColaboradorParaCasar[],
  extrasDoMes: Map<number, HorasExtrasDoMes>,
  competencia: string | null,
): ResultadoComparacaoRecibo {
  const cpfPorCodigo = new Map(liquidos.map((l) => [l.codigo, l.cpf]));
  const colaboradorPorCpf = new Map(
    colaboradores.filter((c) => c.cpf).map((c) => [somenteDigitos(c.cpf), c]),
  );
  const salarioMinimo = salarioMinimoDa(competencia);

  const linhas: LinhaComparacaoRecibo[] = [];
  const descartados: ResultadoComparacaoRecibo["descartados"] = [];

  for (const holerite of holerites) {
    if (holerite.salarioBase === null) continue;
    const cpf = cpfPorCodigo.get(holerite.codigo);
    let colaborador = cpf ? colaboradorPorCpf.get(somenteDigitos(cpf)) : undefined;

    if (!colaborador) {
      const porNome = casarPorNome(holerite.nome, colaboradores, (c) => c.nome);
      if (porNome.ambiguo) {
        descartados.push({
          codigo: holerite.codigo,
          nome: holerite.nome,
          motivo: `"${holerite.nome}" bate com mais de um colaborador do cadastro — confira manualmente.`,
        });
        continue;
      }
      colaborador = porNome.encontrado ?? undefined;
    }

    if (!colaborador) {
      descartados.push({
        codigo: holerite.codigo,
        nome: holerite.nome,
        motivo: `Colaborador "${holerite.nome}" não encontrado no cadastro.`,
      });
      continue;
    }

    const proventos = resumirProventos(holerite.eventos);
    const avisos: string[] = [];

    let periculosidadeNova: number | null = null;
    if (proventos.periculosidade !== null) {
      periculosidadeNova = percentualPadrao(proventos.periculosidade, holerite.salarioBase, PERCENTUAIS_PERICULOSIDADE);
      if (periculosidadeNova === null) {
        avisos.push(
          `Periculosidade de R$ ${proventos.periculosidade.toFixed(2).replace(".", ",")} não bate com ${PERCENTUAIS_PERICULOSIDADE.join("/")}% do salário (mês proporcional?) — não alterada.`,
        );
      }
    }

    let insalubridadeNova: number | null = null;
    if (proventos.insalubridade !== null) {
      insalubridadeNova = percentualPadrao(proventos.insalubridade, salarioMinimo, PERCENTUAIS_INSALUBRIDADE);
      if (insalubridadeNova === null) {
        avisos.push(
          `Insalubridade de R$ ${proventos.insalubridade.toFixed(2).replace(".", ",")} não bate com ${PERCENTUAIS_INSALUBRIDADE.join("/")}% do salário mínimo (mês proporcional?) — não alterada.`,
        );
      }
    }

    const extras = extrasDoMes.get(colaborador.id);
    const horaExtra50Atual = extras?.horaExtra50 ?? 0;
    const horaExtra100Atual = extras?.horaExtra100 ?? 0;
    // Horas somadas de várias linhas acumulam erro de ponto flutuante.
    const horaExtra50Nova = Math.round(proventos.horasExtras50 * 100) / 100;
    const horaExtra100Nova = Math.round(proventos.horasExtras100 * 100) / 100;

    const mudouSalario = Math.abs(colaborador.salarioBase - holerite.salarioBase) >= 0.01;
    const mudouAdicionais =
      (periculosidadeNova !== null && mudou(colaborador.periculosidadePercentual, periculosidadeNova, 0.01)) ||
      (insalubridadeNova !== null && mudou(colaborador.insalubridadePercentual, insalubridadeNova, 0.01));
    // Sem competência no PDF não dá para gravar horas, então não conta como mudança.
    const mudouHoras =
      competencia !== null &&
      (mudou(horaExtra50Atual, horaExtra50Nova, 0.005) || mudou(horaExtra100Atual, horaExtra100Nova, 0.005));

    linhas.push({
      colaboradorId: colaborador.id,
      nome: colaborador.nome,
      salarioAtual: colaborador.salarioBase,
      salarioNovo: holerite.salarioBase,
      periculosidadeAtual: colaborador.periculosidadePercentual,
      periculosidadeNova,
      insalubridadeAtual: colaborador.insalubridadePercentual,
      insalubridadeNova,
      horaExtra50Atual,
      horaExtra50Nova,
      horaExtra100Atual,
      horaExtra100Nova,
      mudouSalario,
      mudouAdicionais,
      mudouHoras,
      mudou: mudouSalario || mudouAdicionais || mudouHoras,
      avisos,
    });
  }

  return { linhas, descartados };
}
