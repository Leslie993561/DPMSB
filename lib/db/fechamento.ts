import "server-only";
import { competenciaFechada } from "./folhaBreakdown";

/**
 * Fechamento de competência, valendo para o portal inteiro.
 *
 * Fechar o mês no Breakdown congela o retrato da folha. Mas benefícios e férias
 * escrevem nos MESMOS meses por outras portas — rateio, variáveis, dias úteis,
 * baixa de gozo — e continuavam aceitando alteração depois do fechamento. Na
 * prática o mês fechado só estava fechado de um lado: o total conferido com a
 * contabilidade podia mudar sozinho dias depois.
 *
 * A regra é uma só: competência fechada não recebe escrita de lugar nenhum. A
 * única exceção é reabrir o mês, que existe justamente para desfazer isso.
 */

/** Competência (AAAA-MM) de uma data ISO — é o mês que manda numa data de gozo ou de lançamento. */
export function competenciaDaData(dataIso: string): string {
  return dataIso.slice(0, 7);
}

/** Competência a partir de ano/mês separados, como chegam nas telas de benefícios. */
export function competenciaDeAnoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function mesPorExtenso(competencia: string): string {
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const mes = Number(competencia.slice(5, 7));
  return `${nomes[mes - 1] ?? competencia.slice(5, 7)}/${competencia.slice(0, 4)}`;
}

/**
 * Devolve uma resposta 409 quando a competência está fechada, ou `null` quando
 * pode seguir. Rota que escreve num mês começa com:
 *
 *     const bloqueio = await bloquearSeFechada(competencia);
 *     if (bloqueio) return bloqueio;
 *
 * 409 e não 403: o pedido não é proibido, está em conflito com o estado do mês
 * — reabrir a competência resolve, e a mensagem diz isso.
 */
export async function bloquearSeFechada(competencia: string): Promise<Response | null> {
  if (!(await competenciaFechada(competencia))) return null;
  return Response.json(
    {
      erro: `A competência ${mesPorExtenso(competencia)} está fechada e não aceita alterações. Reabra o mês no Breakdown de folha para poder editar.`,
      competencia,
      competenciaFechada: true,
    },
    { status: 409 },
  );
}
