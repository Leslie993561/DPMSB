import { z } from "zod";
import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import {
  CAMPOS_COLABORADOR,
  converterParaColaboradoresCadastro,
  sugerirMapeamentoColaborador,
} from "@/lib/parsing/mappers";
import {
  importarColaboradores,
  type RateioD365,
  type SexoColaborador,
  type TipoTransporte,
  type Vinculo,
} from "@/lib/db/colaboradores";

export const runtime = "nodejs";

const EXTENSOES = [".xlsx", ".xls", ".csv"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const schemaConfirmacao = z.object({
  linhas: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  // Derivado da lista de campos, nunca escrito à mão: um campo novo no
  // mapeamento passa a ser aceito sozinho. Enumerar aqui já fez a importação
  // descartar em silêncio o VT por dia, os adicionais e o rateio D365.
  mapeamento: z.object(
    Object.fromEntries(CAMPOS_COLABORADOR.map((campo) => [campo, z.string().nullable().optional()])) as Record<
      (typeof CAMPOS_COLABORADOR)[number],
      z.ZodOptional<z.ZodNullable<z.ZodString>>
    >,
  ),
});

/**
 * Duas formas de uso:
 * - multipart/form-data com `arquivo`: faz o parse e devolve cabeçalhos +
 *   sugestões de mapeamento (primeiro passo, sem gravar nada).
 * - application/json com `linhas` + `mapeamento` (já confirmado pelo
 *   usuário): grava o lote no cadastro (segundo passo).
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!EXTENSOES.some((ext) => arquivo.name.toLowerCase().endsWith(ext))) {
      return Response.json(
        { erro: `Formato não suportado. Envie um arquivo ${EXTENSOES.join(", ")}.` },
        { status: 400 },
      );
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return Response.json({ erro: "Arquivo maior que 5 MB." }, { status: 400 });
    }

    try {
      const { cabecalhos, linhas } = await parsearPlanilha(await arquivo.arrayBuffer(), arquivo.name);
      return Response.json({
        cabecalhos,
        linhas,
        sugestoes: sugerirMapeamentoColaborador(cabecalhos),
        totalLinhas: linhas.length,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
      return Response.json({ erro: mensagem }, { status: 400 });
    }
  }

  const body = await request.json();
  const parsed = schemaConfirmacao.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  let conversao;
  try {
    conversao = converterParaColaboradoresCadastro(parsed.data.linhas, parsed.data.mapeamento);
  } catch (err) {
    return Response.json(
      { erro: err instanceof Error ? err.message : "Erro ao mapear as colunas." },
      { status: 400 },
    );
  }

  const resultado = await importarColaboradores(
    conversao.colaboradores.map((c) => ({
      ...c,
      vinculo: c.vinculo as Vinculo | null,
      // Coluna de transporte ausente na planilha vira undefined, não null: a
      // regra da importação é que campo em branco não apaga o que já existe.
      tipoTransporte: (c.tipoTransporte as TipoTransporte | null) ?? undefined,
      rateioD365: (c.rateioD365 as RateioD365 | null) ?? undefined,
      conjugeSexo: (c.conjugeSexo as SexoColaborador | null) ?? undefined,
    })),
  );
  return Response.json({
    criados: resultado.criados,
    atualizados: resultado.atualizados,
    parecidos: resultado.parecidos,
    // As duas listas: a planilha rejeitou a linha (descartadas) ou o cadastro
    // não soube em quem aplicar (descartados). Somir com a segunda fazia a
    // importação dizer "50 atualizados" sobre um arquivo de 53 linhas.
    descartadas: [...conversao.descartadas, ...resultado.descartados],
  });
}
