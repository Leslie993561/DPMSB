import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarColaboradores, atualizarColaborador } from "@/lib/db/colaboradores";
import { parsearReciboPagamento, parsearRelatorioLiquidos } from "@/lib/parsing/pdfReciboPagamento";
import { compararSalarios } from "@/lib/parsing/folhaSalarios";

export const runtime = "nodejs";

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const schemaAplicar = z.object({
  atualizacoes: z.array(
    z.object({
      colaboradorId: z.number().int().positive(),
      salarioBase: z.coerce.number().positive(),
    }),
  ),
});

/**
 * Duas formas de uso — mesmo padrão de /api/colaboradores/importar:
 * - multipart/form-data com `recibo` + `liquidos`: lê os dois PDFs, casa cada
 *   funcionário com o cadastro e devolve a comparação (primeiro passo, sem
 *   gravar nada).
 * - application/json com `atualizacoes` (já confirmadas pelo usuário): grava
 *   o novo Salário Base no cadastro (segundo passo). INSS/FGTS/IRRF nunca são
 *   gravados aqui — o Breakdown os recalcula sozinho a partir do salário base.
 */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const recibo = formData.get("recibo");
    const liquidos = formData.get("liquidos");

    if (!(recibo instanceof File) || !(liquidos instanceof File)) {
      return Response.json(
        { erro: "Envie os dois arquivos: Recibo de Pagamento e Relatório de Líquidos." },
        { status: 400 },
      );
    }
    if (recibo.size > TAMANHO_MAXIMO || liquidos.size > TAMANHO_MAXIMO) {
      return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 400 });
    }

    try {
      const [dadosRecibo, dadosLiquidos, colaboradores] = await Promise.all([
        parsearReciboPagamento(await recibo.arrayBuffer()),
        parsearRelatorioLiquidos(await liquidos.arrayBuffer()),
        listarColaboradores(),
      ]);
      const comparacao = compararSalarios(dadosRecibo, dadosLiquidos, colaboradores);
      return Response.json({
        linhas: comparacao.linhas,
        descartados: comparacao.descartados,
        totalNoArquivo: dadosRecibo.length,
      });
    } catch (erro) {
      return Response.json(
        { erro: erro instanceof Error ? erro.message : "Falha ao ler os arquivos." },
        { status: 400 },
      );
    }
  }

  const parsed = schemaAplicar.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  for (const item of parsed.data.atualizacoes) {
    await atualizarColaborador(item.colaboradorId, { salarioBase: item.salarioBase });
  }
  return Response.json({ aplicadas: parsed.data.atualizacoes.length });
}
