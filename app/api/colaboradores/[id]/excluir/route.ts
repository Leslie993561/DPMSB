import { buscarColaborador, contarVinculos, excluirColaborador, excluirColaboradorComHistorico } from "@/lib/db/colaboradores";
import { obterSessaoAtual } from "@/lib/auth/sessao";

export const runtime = "nodejs";

/**
 * Exclusão definitiva do colaborador — para o cadastro criado por engano.
 *
 * Quem tem histórico NÃO é apagado de primeira: a rota responde 409 com
 * `exigeConfirmacao` e diz exatamente o que existe amarrado a ele. A tela então
 * pergunta "Tem certeza?" e, se o RH confirmar, repete o pedido com
 * `{ "forcar": true }` — aí apaga tudo junto, sem volta. Para quem saiu da
 * empresa o caminho certo continua sendo o desligamento, que preserva o histórico.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/colaboradores/[id]/excluir">) {
  const sessao = await obterSessaoAtual();
  if (sessao?.tipo !== "administrador") {
    return Response.json({ erro: "Só o RH pode excluir colaboradores." }, { status: 403 });
  }

  const corpo = (await request.json().catch(() => ({}))) as { forcar?: boolean };
  const forcar = corpo.forcar === true;
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

  if (vinculos.beneficiosLancados > 0) impedimentos.push(`${vinculos.beneficiosLancados} lançamento(s) de benefícios`);
  if (vinculos.registrosSst > 0) impedimentos.push(`${vinculos.registrosSst} registro(s) de SST (EPI, fardamento, exames)`);
  if (vinculos.kitsEntregues > 0) impedimentos.push(`${vinculos.kitsEntregues} kit(s) entregue(s) pelo DHO`);
  if (vinculos.movimentacoes > 0) impedimentos.push(`${vinculos.movimentacoes} movimentação(ões)`);
  if (vinculos.acessoGestor > 0) impedimentos.push("acesso de gestor ao portal");

  if (impedimentos.length > 0 && forcar) {
    try {
      await excluirColaboradorComHistorico(colaboradorId);
    } catch (erro) {
      console.error("Falha ao excluir colaborador com histórico", colaboradorId, erro);
      return Response.json({ erro: "Não foi possível excluir: há registros ligados a este colaborador que o sistema não conseguiu remover. Nada foi apagado." }, { status: 409 });
    }
    return Response.json({ excluido: true, nome: colaborador.nome.trim(), comHistorico: true });
  }

  if (impedimentos.length > 0) {
    return Response.json(
      {
        erro: `${colaborador.nome.trim()} tem histórico ligado a ele: ${impedimentos.join(", ")}.`,
        exigeConfirmacao: true,
        impedimentos,
      },
      { status: 409 },
    );
  }

  try {
    await excluirColaborador(colaboradorId);
  } catch (erro) {
    // Qualquer vínculo que a checagem acima não conheça cai aqui como erro do banco;
    // sem isso a tela só via uma resposta vazia e dizia "falha de comunicação".
    console.error("Falha ao excluir colaborador", colaboradorId, erro);
    return Response.json(
      { erro: "Não foi possível excluir: ainda há registros ligados a este colaborador. Use “Desligar colaborador”." },
      { status: 409 },
    );
  }
  return Response.json({ excluido: true, nome: colaborador.nome.trim() });
}
