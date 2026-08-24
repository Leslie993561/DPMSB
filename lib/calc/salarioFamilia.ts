import { getLegalTable } from "../legal-tables";
import { arredondar } from "./types";

export interface DependenteParaSalarioFamilia {
  dataNascimento: string | null;
}

export interface ResultadoSalarioFamilia {
  valor: number;
  /** Filhos que efetivamente geraram cota. */
  filhosComCota: number;
  /**
   * Dependentes cadastrados SEM data de nascimento. Não entram na cota — sem a
   * data não dá para saber se têm menos de 14 anos, e presumir criaria dinheiro
   * na folha. Serve para a tela avisar que falta completar o cadastro.
   */
  semDataNascimento: number;
  cotaPorFilho: number;
  /** false quando a remuneração passa do teto: nesse caso não há cota nenhuma. */
  dentroDoTeto: boolean;
}

/** Idade completa em anos na data de referência. */
function idadeEm(dataNascimento: string, referencia: Date): number {
  const nasc = new Date(dataNascimento);
  let idade = referencia.getFullYear() - nasc.getFullYear();
  const mes = referencia.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < nasc.getDate())) idade--;
  return idade;
}

/**
 * Salário família (Lei 8.213/91, Art. 65): cota fixa por filho menor de 14 anos,
 * devida a quem recebe até o teto do ano. O valor é pago pelo empregador e
 * compensado na guia do INSS — ou seja, não é custo dele, e por isso não entra
 * no custo total do Breakdown.
 *
 * Filho inválido tem direito em qualquer idade, mas o cadastro não registra
 * invalidez; esses casos precisam ser lançados à parte pelo DP.
 */
export function calcularSalarioFamilia(
  salarioBase: number,
  dependentes: DependenteParaSalarioFamilia[],
  competencia: Date,
): ResultadoSalarioFamilia {
  const tabela = getLegalTable(competencia);
  const { cotaPorFilho, tetoRemuneracao } = tabela.salarioFamilia;
  const dentroDoTeto = salarioBase <= tetoRemuneracao;

  const semDataNascimento = dependentes.filter((d) => !d.dataNascimento).length;
  const filhosComCota = dentroDoTeto
    ? dependentes.filter((d) => d.dataNascimento && idadeEm(d.dataNascimento, competencia) < 14).length
    : 0;

  return {
    valor: arredondar(filhosComCota * cotaPorFilho),
    filhosComCota,
    semDataNascimento,
    cotaPorFilho,
    dentroDoTeto,
  };
}
