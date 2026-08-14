import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { sugerirMapeamento } from "@/lib/parsing/mappers";

export const runtime = "nodejs";

const EXTENSOES = [".xlsx", ".xls", ".csv"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
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
      sugestoes: sugerirMapeamento(cabecalhos),
      totalLinhas: linhas.length,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
    return Response.json({ erro: mensagem }, { status: 400 });
  }
}
