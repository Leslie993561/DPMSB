import "server-only";
import { casarPorNome } from "@/lib/folha/casarNome";
import type { FuncionarioLiquido, FuncionarioRecibo } from "./pdfReciboPagamento";

export interface ColaboradorParaCasar {
  id: number;
  nome: string;
  cpf: string | null;
  salarioBase: number;
}

export interface LinhaComparacaoSalario {
  colaboradorId: number;
  nome: string;
  salarioAtual: number;
  salarioNovo: number;
  mudou: boolean;
}

export interface ResultadoComparacaoSalarios {
  linhas: LinhaComparacaoSalario[];
  descartados: { codigo: string; nome: string; motivo: string }[];
}

function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}

/**
 * Casa cada funcionário do Recibo de Pagamento com um colaborador do cadastro
 * e compara o Salário Base — pelo CPF (via Relatório de Líquidos, que é quem
 * traz o CPF) e, faltando CPF (ex.: mês inteiro afastado, fora do relatório
 * de líquidos), pelo nome. INSS/FGTS/IRRF não entram aqui: são calculados a
 * partir do salário base, não importados.
 */
export function compararSalarios(
  recibos: FuncionarioRecibo[],
  liquidos: FuncionarioLiquido[],
  colaboradores: ColaboradorParaCasar[],
): ResultadoComparacaoSalarios {
  const cpfPorCodigo = new Map(liquidos.map((l) => [l.codigo, l.cpf]));
  const colaboradorPorCpf = new Map(
    colaboradores.filter((c) => c.cpf).map((c) => [somenteDigitos(c.cpf), c]),
  );

  const linhas: LinhaComparacaoSalario[] = [];
  const descartados: ResultadoComparacaoSalarios["descartados"] = [];

  for (const recibo of recibos) {
    const cpf = cpfPorCodigo.get(recibo.codigo);
    let colaborador = cpf ? colaboradorPorCpf.get(somenteDigitos(cpf)) : undefined;

    if (!colaborador) {
      const porNome = casarPorNome(recibo.nome, colaboradores, (c) => c.nome);
      if (porNome.ambiguo) {
        descartados.push({
          codigo: recibo.codigo,
          nome: recibo.nome,
          motivo: `"${recibo.nome}" bate com mais de um colaborador do cadastro — confira manualmente.`,
        });
        continue;
      }
      colaborador = porNome.encontrado ?? undefined;
    }

    if (!colaborador) {
      descartados.push({
        codigo: recibo.codigo,
        nome: recibo.nome,
        motivo: `Colaborador "${recibo.nome}" não encontrado no cadastro.`,
      });
      continue;
    }

    linhas.push({
      colaboradorId: colaborador.id,
      nome: colaborador.nome,
      salarioAtual: colaborador.salarioBase,
      salarioNovo: recibo.salarioBase,
      mudou: Math.abs(colaborador.salarioBase - recibo.salarioBase) >= 0.01,
    });
  }

  return { linhas, descartados };
}
