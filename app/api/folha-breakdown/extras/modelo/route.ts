import ExcelJS from "exceljs";

export const runtime = "nodejs";

const COLUNAS = [
  { header: "Código", key: "codigo", width: 10 },
  { header: "Nome do colaborador", key: "nome", width: 28 },
  { header: "VM", key: "vm", width: 12 },
  { header: "Odontológico", key: "odontologico", width: 14 },
  { header: "Sólides", key: "solides", width: 12 },
  { header: "Flash", key: "flash", width: 12 },
  { header: "Bonificação", key: "bonificacao", width: 14 },
  { header: "Premiação", key: "premiacao", width: 14 },
];

/** Modelo baixável para a importação de verbas extras do Relatório detalhado (Breakdown de Folha). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Verbas extras");
  sheet.columns = COLUNAS;
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    codigo: "63",
    nome: "Alice Coutinho da Cruz",
    vm: 0,
    odontologico: 65,
    solides: 0,
    flash: 0,
    bonificacao: 0,
    premiacao: 0,
  });
  sheet.addRow({
    codigo: "64",
    nome: "Ana Beatriz Souza Figueiredo",
    vm: 166.74,
    odontologico: 65,
    solides: 60,
    flash: 0,
    bonificacao: 0,
    premiacao: 0,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-verbas-extras.xlsx"',
    },
  });
}
