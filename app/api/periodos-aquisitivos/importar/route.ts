import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { parsearProgramacaoFeriasPdf } from "@/lib/parsing/pdfProgramacaoFerias";
import { converterProgramacaoFerias } from "@/lib/parsing/programacaoFerias";
import { importarProgramacaoFerias } from "@/lib/db/importarProgramacaoFerias";

export const runtime = "nodejs";

/**
 * Lê um arquivo de "Programação de Férias" (XLSX/XLS/CSV ou PDF) e aplica ao
 * Controle de Férias. XLSX/CSV são lidos de forma estruturada (alta
 * confiança); PDF é melhor esforço (ver `pdfProgramacaoFerias.ts`) — sempre
 * revise `descartados` antes de considerar a importação bem-sucedida.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.size > 10 * 1024 * 1024) {
    return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 400 });
  }

  const buffer = await arquivo.arrayBuffer();
  const nome = arquivo.name.toLowerCase();

  try {
    let cabecalhos: string[];
    let linhas: Awaited<ReturnType<typeof parsearPlanilha>>["linhas"];

    if (nome.endsWith(".pdf")) {
      const tabela = await parsearProgramacaoFeriasPdf(buffer);
      cabecalhos = tabela.cabecalhos;
      linhas = tabela.linhas;
    } else {
      const planilha = await parsearPlanilha(buffer, arquivo.name);
      cabecalhos = planilha.cabecalhos;
      linhas = planilha.linhas;
    }

    const conversao = converterProgramacaoFerias(cabecalhos, linhas);
    const resultado = await importarProgramacaoFerias(conversao.itens, arquivo.name);

    return Response.json({
      atualizados: resultado.atualizados,
      criados: resultado.criados,
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
