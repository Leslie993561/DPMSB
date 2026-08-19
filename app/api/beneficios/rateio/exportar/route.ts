import ExcelJS from "exceljs";
import { z } from "zod";
import { gerarRateio } from "@/lib/db/beneficiosRateio";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ competencia: searchParams.get("competencia") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?competencia=AAAA-MM." }, { status: 400 });
  }

  const { linhas } = await gerarRateio(parsed.data.competencia);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rateio");
  sheet.columns = [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Nome completo", key: "nome", width: 30 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Vínculo", key: "vinculo", width: 12 },
    { header: "Departamento", key: "departamento", width: 20 },
    { header: "Cidade", key: "cidade", width: 18 },
    { header: "Transporte", key: "transporte", width: 14 },
    { header: "Alimentação", key: "alimentacao", width: 14 },
    { header: "Total", key: "total", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const l of linhas) {
    sheet.addRow({
      codigo: l.colaboradorId,
      nome: l.nome,
      cpf: l.cpf ?? "",
      vinculo: l.vinculo ?? "",
      departamento: l.departamento ?? "",
      cidade: l.cidade ?? "",
      transporte: l.valeTransporte,
      alimentacao: l.valeAlimentacao,
      total: l.valeTransporte + l.valeAlimentacao,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rateio-beneficios-${parsed.data.competencia}.xlsx"`,
    },
  });
}
