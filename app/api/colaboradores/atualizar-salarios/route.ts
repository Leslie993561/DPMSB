import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarColaboradores, atualizarColaborador } from "@/lib/db/colaboradores";
import { bloquearSeFechada } from "@/lib/db/fechamento";
import { obterExtras, upsertExtras, type ExtrasImportadas, type CampoVerba } from "@/lib/db/folhaBreakdown";
import { lerHolerites, parsearRelatorioLiquidos } from "@/lib/parsing/pdfReciboPagamento";
import { compararRecibos } from "@/lib/parsing/folhaSalarios";

export const runtime = "nodejs";

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

const schemaAplicar = z.object({
  /** Competência lida do recibo — obrigatória só quando alguma atualização traz horas extras. */
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  atualizacoes: z.array(
    z.object({
      colaboradorId: z.number().int().positive(),
      salarioBase: z.coerce.number().positive().optional(),
      periculosidadePercentual: z.coerce.number().min(0).max(100).optional(),
      insalubridadePercentual: z.coerce.number().min(0).max(100).optional(),
      horaExtra50: z.coerce.number().min(0).optional(),
      horaExtra100: z.coerce.number().min(0).optional(),
    }),
  ),
});

/** Competência mais frequente entre os holerites (o recibo é de um mês só; a moda protege de uma via mal lida). */
function competenciaDoRecibo(competencias: (string | null)[]): string | null {
  const contagem = new Map<string, number>();
  for (const c of competencias) if (c) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Duas formas de uso — mesmo padrão de /api/colaboradores/importar:
 * - multipart/form-data com `recibo` + `liquidos`: lê os dois PDFs, casa cada
 *   funcionário com o cadastro e devolve a comparação (primeiro passo, sem
 *   gravar nada).
 * - application/json com `atualizacoes` (já confirmadas pelo usuário): grava no
 *   cadastro o Salário Base e os percentuais de periculosidade/insalubridade, e
 *   lança as horas extras na competência do recibo (segundo passo).
 *   INSS/FGTS/IRRF nunca são gravados aqui — o Breakdown os recalcula sozinho a
 *   partir do salário base.
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
      const [holerites, dadosLiquidos, colaboradores] = await Promise.all([
        lerHolerites(await recibo.arrayBuffer()),
        parsearRelatorioLiquidos(await liquidos.arrayBuffer()),
        listarColaboradores(),
      ]);
      if (holerites.length === 0) {
        return Response.json(
          { erro: "Não encontrei nenhum holerite com Salário Base neste PDF. Confira se é o Recibo de Pagamento." },
          { status: 400 },
        );
      }

      const competencia = competenciaDoRecibo(holerites.map((h) => h.competencia));
      const extrasDoMes = competencia ? await obterExtras(competencia) : new Map();
      const comparacao = compararRecibos(holerites, dadosLiquidos, colaboradores, extrasDoMes, competencia);
      return Response.json({
        competencia,
        linhas: comparacao.linhas,
        descartados: comparacao.descartados,
        totalNoArquivo: holerites.length,
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
  const { competencia, atualizacoes } = parsed.data;

  const temHoras = atualizacoes.some((a) => a.horaExtra50 !== undefined || a.horaExtra100 !== undefined);
  if (temHoras) {
    if (!competencia) {
      return Response.json({ erro: "O recibo não informa o mês — não dá para lançar as horas extras." }, { status: 400 });
    }
    const bloqueio = await bloquearSeFechada(competencia);
    if (bloqueio) return bloqueio;
  }

  for (const item of atualizacoes) {
    const cadastro = {
      ...(item.salarioBase !== undefined && { salarioBase: item.salarioBase }),
      ...(item.periculosidadePercentual !== undefined && { periculosidadePercentual: item.periculosidadePercentual }),
      ...(item.insalubridadePercentual !== undefined && { insalubridadePercentual: item.insalubridadePercentual }),
    };
    if (Object.keys(cadastro).length > 0) await atualizarColaborador(item.colaboradorId, cadastro);

    if (competencia && (item.horaExtra50 !== undefined || item.horaExtra100 !== undefined)) {
      const campos: CampoVerba[] = [];
      const extras: Partial<ExtrasImportadas> = {};
      if (item.horaExtra50 !== undefined) {
        campos.push("horaExtra50");
        extras.horaExtra50 = item.horaExtra50;
      }
      if (item.horaExtra100 !== undefined) {
        campos.push("horaExtra100");
        extras.horaExtra100 = item.horaExtra100;
      }
      // Só as horas vão; as demais verbas do mês ficam como estavam.
      await upsertExtras(item.colaboradorId, competencia, extras as ExtrasImportadas, campos);
    }
  }
  return Response.json({ aplicadas: atualizacoes.length });
}
