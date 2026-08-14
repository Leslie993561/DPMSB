import ExcelJS from "exceljs";

export const runtime = "nodejs";

const COLUNAS = [
  { header: "Código", key: "codigo", width: 10 },
  { header: "Empregado", key: "empregado", width: 30 },
  { header: "Início do período aquisitivo", key: "inicio", width: 22 },
  { header: "Fim do período aquisitivo", key: "fim", width: 22 },
  { header: "Dias de direito", key: "direito", width: 14 },
  { header: "Dias gozados", key: "gozados", width: 12 },
  { header: "Abono", key: "abono", width: 10 },
];

/** Modelo baixável para a importação de Programação de Férias (Controle de Férias → Importar arquivo). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programação de Férias");
  sheet.columns = COLUNAS;
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    codigo: "63",
    empregado: "Maria da Silva",
    inicio: "15/09/2024",
    fim: "15/09/2025",
    direito: 30,
    gozados: 10,
    abono: "Não",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-programacao-ferias.xlsx"',
    },
  });
}
