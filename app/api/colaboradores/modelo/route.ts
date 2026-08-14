import ExcelJS from "exceljs";

export const runtime = "nodejs";

const COLUNAS = [
  { header: "Nome completo", key: "nome", width: 28 },
  { header: "Data de admissão", key: "dataAdmissao", width: 16 },
  { header: "Nascimento", key: "dataNascimento", width: 14 },
  { header: "CPF", key: "cpf", width: 16 },
  { header: "E-mail", key: "email", width: 26 },
  { header: "Cargo", key: "cargo", width: 18 },
  { header: "Departamento", key: "departamento", width: 18 },
  { header: "Vínculo", key: "vinculo", width: 10 },
  { header: "Líder direto", key: "liderDireto", width: 20 },
  { header: "Salário", key: "salarioBase", width: 12 },
  { header: "Alimentação", key: "alimentacaoValor", width: 12 },
  { header: "CBO", key: "cbo", width: 10 },
  { header: "Cidade", key: "cidade", width: 16 },
  { header: "Agência", key: "agencia", width: 10 },
  { header: "Conta", key: "conta", width: 12 },
];

/** Gera o modelo de planilha para importação de colaboradores — mesmas colunas lidas por `lib/parsing/mappers.ts`. */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Colaboradores");
  sheet.columns = COLUNAS;
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    nome: "Maria da Silva",
    dataAdmissao: "15/03/2024",
    dataNascimento: "20/05/1990",
    cpf: "123.456.789-00",
    email: "maria.silva@msbbrasil.com",
    cargo: "Analista",
    departamento: "Produção",
    vinculo: "CLT",
    liderDireto: "Nome do gestor",
    salarioBase: 3000,
    alimentacaoValor: 600,
    cbo: "784205",
    cidade: "Salvador",
    agencia: "8212-0",
    conta: "12345-6",
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-colaboradores.xlsx"',
    },
  });
}
