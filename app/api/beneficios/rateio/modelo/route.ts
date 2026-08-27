import ExcelJS from "exceljs";

export const runtime = "nodejs";

/** Modelo baixável para a importação de rateio de benefícios (VT/VA por colaborador). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Rateio");
  sheet.columns = [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Nome do colaborador", key: "nome", width: 28 },
    { header: "Transporte", key: "transporte", width: 14 },
    { header: "Alimentação", key: "alimentacao", width: 14 },
    { header: "Variáveis", key: "variaveis", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  // Variáveis em branco mantém o que o portal calcula (o presente de
  // aniversário do mês); preenchida, o valor da planilha é o que vale.
  sheet.addRow({ codigo: "63", nome: "ALICE COUTINHO DA CRUZ", transporte: 218.4, alimentacao: 802.5, variaveis: 70 });
  sheet.addRow({ codigo: "64", nome: "ANA BEATRIZ SOUZA FIGUEIREDO", transporte: 218.4, alimentacao: 802.5, variaveis: null });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-rateio-beneficios.xlsx"',
    },
  });
}
