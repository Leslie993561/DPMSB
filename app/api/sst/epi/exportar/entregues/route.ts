import ExcelJS from "exceljs";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarEntregasConfirmadasParaExportacao } from "@/lib/sst/epi";

export const runtime = "nodejs";

/** Exporta todas as entregas de EPI e fardamento já confirmadas — "Opção 1" do popover de exportar. */
export async function GET() {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const linhas = await listarEntregasConfirmadasParaExportacao();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entregas");
  sheet.columns = [
    { header: "Colaborador", key: "nome", width: 32 },
    { header: "Cargo", key: "cargo", width: 22 },
    { header: "Departamento", key: "departamento", width: 22 },
    { header: "Categoria", key: "categoria", width: 12 },
    { header: "Item", key: "item", width: 26 },
    { header: "C.A.", key: "ca", width: 10 },
    { header: "Qtd", key: "qtd", width: 8 },
    { header: "Valor unit.", key: "valorUnit", width: 12 },
    { header: "Valor total", key: "valorTotal", width: 12 },
    { header: "Data de entrega", key: "dataEntrega", width: 15 },
    { header: "Troca prevista", key: "dataTroca", width: 15 },
    { header: "Responsável", key: "responsavel", width: 26 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const l of linhas) {
    sheet.addRow({
      nome: l.nome,
      cargo: l.cargo ?? "",
      departamento: l.departamento ?? "",
      categoria: l.categoria,
      item: l.item,
      ca: l.ca || "",
      qtd: l.qtd,
      valorUnit: l.valorUnit,
      valorTotal: l.qtd * l.valorUnit,
      dataEntrega: l.dataEntrega || "",
      dataTroca: l.dataTroca || "",
      responsavel: l.responsavel,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="epi-entregas.xlsx"',
    },
  });
}
