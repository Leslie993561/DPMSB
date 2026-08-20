import ExcelJS from "exceljs";
import { COLUNAS_COLABORADOR, colunasDependentes } from "@/lib/planilhas/colunasColaborador";

export const runtime = "nodejs";

/**
 * Modelo de planilha para importação — exatamente as mesmas colunas (e ordem)
 * da exportação e dos 7 blocos da ficha do colaborador, sem nenhuma linha
 * preenchida: só os cabeçalhos, para o DP preencher.
 *
 * Traz um trio de colunas de dependente (o formulário também começa com um);
 * para lançar mais de um, basta duplicar as colunas mantendo a numeração
 * ("Dependente 2 — Nome", "Dependente 2 — Nascimento", ...), que a importação
 * reconhece pelo padrão do nome.
 */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Colaboradores");
  sheet.columns = [...COLUNAS_COLABORADOR, ...colunasDependentes(1)];

  const cabecalho = sheet.getRow(1);
  cabecalho.font = { bold: true };
  cabecalho.alignment = { vertical: "middle", wrapText: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-colaboradores.xlsx"',
    },
  });
}
