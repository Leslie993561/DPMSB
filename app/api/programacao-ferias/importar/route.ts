import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { converterProgramacaoAnual } from "@/lib/parsing/programacaoAnual";
import { importarProgramacaoAnual } from "@/lib/db/importarProgramacaoAnual";

export const runtime = "nodejs";

/** Lê a planilha "Programação Anual" (XLSX/XLS/CSV) e lança as programações futuras (status "programada"). */
export async function POST(request: Request) {
  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 400 });
  }
  if (arquivo.name.toLowerCase().endsWith(".pdf")) {
    return Response.json(
      { erro: "PDF não é suportado neste assistente — envie XLS, XLSX ou CSV." },
      { status: 400 },
    );
  }

  try {
    const buffer = await arquivo.arrayBuffer();
    const { cabecalhos, linhas } = await parsearPlanilha(buffer, arquivo.name);
    const conversao = converterProgramacaoAnual(cabecalhos, linhas);
    const resultado = importarProgramacaoAnual(conversao.itens, arquivo.name);

    return Response.json({
      lancados: resultado.lancados,
      periodosCriados: resultado.periodosCriados,
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
