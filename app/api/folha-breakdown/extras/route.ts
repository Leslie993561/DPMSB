import { z } from "zod";
import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { parsearFolhaExtrasPdf } from "@/lib/parsing/pdfFolhaExtras";
import { converterExtrasImportadas } from "@/lib/parsing/folhaExtras";
import { importarExtras } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

/** Lê a planilha (ou PDF) de verbas extras e aplica em uma competência — "Importar planilha" do Relatório detalhado. */
export async function POST(request: Request) {
  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  const parsed = schema.safeParse({ competencia: formData.get("competencia") });

  if (!(arquivo instanceof File)) {
    return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ erro: "Informe o mês de referência da planilha." }, { status: 400 });
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 400 });
  }

  try {
    const buffer = await arquivo.arrayBuffer();
    const ehPdf = arquivo.name.toLowerCase().endsWith(".pdf");
    const { cabecalhos, linhas } = ehPdf
      ? await parsearFolhaExtrasPdf(buffer)
      : await parsearPlanilha(buffer, arquivo.name);

    const conversao = converterExtrasImportadas(cabecalhos, linhas);
    // Só as verbas presentes no arquivo são gravadas; as ausentes ficam como
    // estavam. Ver upsertExtras.
    const resultado = await importarExtras(
      conversao.itens,
      parsed.data.competencia,
      conversao.camposPresentes.filter((c) => c !== "codigo" && c !== "nomeColaborador"),
    );

    return Response.json({
      aplicadas: resultado.aplicadas,
      colunasReconhecidas: conversao.colunasReconhecidas,
      colunasOutros: conversao.colunasOutros,
      colunasNaoEncontradas: conversao.colunasNaoEncontradas,
      // Os cabeçalhos crus do arquivo. É o que permite ver, sem abrir a
      // planilha, por que uma verba não entrou: quase sempre a coluna existe
      // com outro nome, e sem isso a investigação vira adivinhação.
      cabecalhosDoArquivo: cabecalhos,
      descartados: [...conversao.descartadas, ...resultado.descartados],
      totalLinhas: linhas.length,
    });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao ler o arquivo." },
      { status: 400 },
    );
  }
}
