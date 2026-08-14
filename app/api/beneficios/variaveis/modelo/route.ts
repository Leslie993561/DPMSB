import ExcelJS from "exceljs";

export const runtime = "nodejs";

/** Modelo baixável para a importação de variáveis (Transporte/Mobilidade/Alimentação avulsos, com motivo). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Variáveis");
  sheet.columns = [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Nome do colaborador", key: "nome", width: 28 },
    { header: "Transporte", key: "transporte", width: 14 },
    { header: "Mobilidade", key: "mobilidade", width: 14 },
    { header: "Alimentação", key: "alimentacao", width: 14 },
    { header: "Motivo", key: "motivo", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ codigo: "63", nome: "Alice Coutinho da Cruz", transporte: 45, mobilidade: null, alimentacao: null, motivo: "Deslocamento para treinamento externo" });
  sheet.addRow({ codigo: "64", nome: "Ana Beatriz Souza Figueiredo", transporte: null, mobilidade: 30, alimentacao: null, motivo: "Uso de aplicativo em visita a cliente" });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-variaveis-beneficios.xlsx"',
    },
  });
}
