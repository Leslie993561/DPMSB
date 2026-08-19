import ExcelJS from "exceljs";
import { z } from "zod";
import { obterBreakdown } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/), setor: z.string().nullable() });

/** Exporta o breakdown de custo por colaborador (Relatório detalhado) — uma linha por colaborador, uma coluna por verba. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ competencia: searchParams.get("competencia"), setor: searchParams.get("setor") });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?competencia=AAAA-MM." }, { status: 400 });
  }

  const { linhas } = await obterBreakdown(parsed.data.competencia);
  const filtradas = parsed.data.setor ? linhas.filter((l) => l.departamento === parsed.data.setor) : linhas;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Folha por colaborador");
  sheet.columns = [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Colaborador", key: "nome", width: 30 },
    { header: "Cargo", key: "cargo", width: 20 },
    { header: "Departamento", key: "departamento", width: 20 },
    { header: "Salário base", key: "salarioBase", width: 14 },
    { header: "INSS", key: "inss", width: 12 },
    { header: "IRRF", key: "irrf", width: 12 },
    { header: "FGTS", key: "fgts", width: 12 },
    { header: "Provisão 13º", key: "provisao", width: 14 },
    { header: "Total de encargos", key: "totalEncargos", width: 16 },
    { header: "VT", key: "vt", width: 12 },
    { header: "VA", key: "va", width: 12 },
    { header: "VM", key: "vm", width: 12 },
    { header: "Odontológico", key: "odontologico", width: 14 },
    { header: "Sólides", key: "solides", width: 12 },
    { header: "Flash", key: "flash", width: 12 },
    { header: "Premiação", key: "premiacao", width: 14 },
    { header: "Bonificação", key: "bonificacao", width: 14 },
    { header: "Outros custos", key: "outrosCustos", width: 14 },
    { header: "Custo total", key: "custoTotal", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const l of filtradas) {
    sheet.addRow({
      codigo: l.colaboradorId,
      nome: l.nome,
      cargo: l.cargo ?? "",
      departamento: l.departamento ?? "",
      salarioBase: l.salarioBase,
      inss: l.inss,
      irrf: l.irrf,
      fgts: l.fgts,
      provisao: l.provisaoDecimoTerceiro,
      totalEncargos: l.inss + l.fgts + l.provisaoDecimoTerceiro,
      vt: l.valeTransporte,
      va: l.valeAlimentacao,
      vm: l.vm ?? "",
      odontologico: l.odontologico ?? "",
      solides: l.solides ?? "",
      flash: l.flash ?? "",
      premiacao: l.premiacao,
      bonificacao: l.bonificacao ?? "",
      outrosCustos: l.outrosCustos ?? "",
      custoTotal: l.custoTotal,
    });
  }

  const nomeArquivo = `folha-por-colaborador-${parsed.data.competencia}${parsed.data.setor ? `-${parsed.data.setor.replace(/\s+/g, "-").toLowerCase()}` : ""}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
