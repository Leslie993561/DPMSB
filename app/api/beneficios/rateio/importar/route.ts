import { z } from "zod";
import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { converterRateioImportado } from "@/lib/parsing/rateioBeneficios";
import { importarRateio } from "@/lib/db/beneficiosRateio";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

/** Lê a planilha de rateio (Transporte/Alimentação por colaborador) e aplica na competência informada. */
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
    const { cabecalhos, linhas } = await parsearPlanilha(buffer, arquivo.name);
    const conversao = converterRateioImportado(cabecalhos, linhas);
    const resultado = await importarRateio(conversao.itens, parsed.data.competencia);

    return Response.json({
      aplicadas: resultado.aplicadas,
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
