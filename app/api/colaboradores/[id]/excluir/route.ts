import { buscarColaborador, contarVinculos, excluirColaborador } from "@/lib/db/colaboradores";

export const runtime = "nodejs";

/**
 * Exclusão definitiva do colaborador — para o cadastro criado por engano.
 *
 * Quem tem histórico não pode ser apagado: a rota recusa e diz exatamente o
 * que existe amarrado a ele. Para quem saiu da empresa o caminho é o
 * desligamento, que preserva férias e folha já apuradas.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/colaboradores/[id]/excluir">) {
  const { id } = await ctx.params;
  const colaboradorId = Number(id);

  const colaborador = await buscarColaborador(colaboradorId);
  if (!colaborador) {
    return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
  }

  const vinculos = await contarVinculos(colaboradorId);
  const impedimentos: string[] = [];
  if (vinculos.periodosAquisitivos > 0) {
    impedimentos.push(`${vinculos.periodosAquisitivos} período(s) aquisitivo(s) de férias`);
  }
  if (vinculos.lancamentosFerias > 0) impedimentos.push(`${vinculos.lancamentosFerias} lançamento(s) de férias`);
  if (vinculos.verbasImportadas > 0) impedimentos.push(`${vinculos.verbasImportadas} mês(es) com verbas importadas`);
  if (vinculos.mesesFechados > 0) impedimentos.push(`${vinculos.mesesFechados} mês(es) de folha já fechado(s)`);
  if (vinculos.liderados > 0) impedimentos.push(`${vinculos.liderados} colaborador(es) que têm ele como gestor`);

  if (impedimentos.length > 0) {
    return Response.json(
      {
        erro:
          `Não dá para excluir ${colaborador.nome.trim()}: existe histórico ligado a ele — ` +
          `${impedimentos.join(", ")}. Apagar arrancaria férias e folha já apuradas. ` +
          "Se a pessoa saiu da empresa, use “Desligar colaborador”, que preserva o histórico.",
        impedimentos,
      },
      { status: 409 },
    );
  }

  await excluirColaborador(colaboradorId);
  return Response.json({ excluido: true, nome: colaborador.nome.trim() });
}
