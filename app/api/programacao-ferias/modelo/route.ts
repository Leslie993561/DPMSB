import ExcelJS from "exceljs";

export const runtime = "nodejs";

const COLUNAS = [
  { header: "Código", key: "codigo", width: 10 },
  { header: "Nome do colaborador", key: "nome", width: 28 },
  { header: "Centro de custo / Setor", key: "setor", width: 22 },
  { header: "Cargo", key: "cargo", width: 18 },
  { header: "Gestor responsável", key: "gestor", width: 22 },
  { header: "Salário base", key: "salario", width: 14 },
  { header: "Data de admissão", key: "admissao", width: 16 },
  { header: "Aquisitivo início", key: "aqInicio", width: 16 },
  { header: "Aquisitivo fim", key: "aqFim", width: 16 },
  { header: "Concessivo início", key: "coInicio", width: 16 },
  { header: "Concessivo fim", key: "coFim", width: 16 },
  { header: "Início das férias", key: "inicioFerias", width: 16 },
  { header: "Data de retorno", key: "retorno", width: 16 },
  { header: "Dias de férias", key: "dias", width: 12 },
  { header: "Abono (Sim/Não)", key: "abono", width: 14 },
  { header: "Dias de abono", key: "diasAbono", width: 12 },
  { header: "Trimestre", key: "trimestre", width: 10 },
  { header: "Observações", key: "obs", width: 24 },
];

/** Modelo baixável para o assistente "Lançar programação anual" (Planejamento de Férias). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Programação Anual");
  sheet.columns = COLUNAS;
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    codigo: "63",
    nome: "Maria da Silva",
    setor: "Produção",
    cargo: "Auxiliar",
    gestor: "Fabiana Sousa",
    salario: 2200,
    admissao: "15/09/2024",
    aqInicio: "15/09/2025",
    aqFim: "15/09/2026",
    coInicio: "15/09/2026",
    coFim: "15/09/2027",
    inicioFerias: "07/09/2026",
    retorno: "27/09/2026",
    dias: 20,
    abono: "Sim",
    diasAbono: 10,
    trimestre: "Q3",
    obs: "",
  });
  sheet.addRow({
    codigo: "65",
    nome: "Ana Maria Alves Santos",
    setor: "Controle da Qualidade",
    cargo: "Inspetora",
    gestor: "Ravena Peixoto",
    salario: 1998.15,
    admissao: "11/02/2020",
    aqInicio: "11/02/2026",
    aqFim: "11/02/2027",
    coInicio: "11/02/2027",
    coFim: "11/02/2028",
    inicioFerias: "11/02/2026",
    retorno: "11/03/2026",
    dias: 28,
    abono: "Não",
    diasAbono: 0,
    trimestre: "Q1",
    obs: "",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-programacao-anual.xlsx"',
    },
  });
}
