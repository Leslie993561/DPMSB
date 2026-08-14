import ExcelJS from "exceljs";
import { listarColaboradores } from "@/lib/db/colaboradores";

export const runtime = "nodejs";

const COLUNAS = [
  { header: "Nome completo", key: "nome", width: 30 },
  { header: "Data de admissão", key: "dataAdmissao", width: 16 },
  { header: "Nascimento", key: "dataNascimento", width: 14 },
  { header: "CPF", key: "cpf", width: 16 },
  { header: "E-mail", key: "email", width: 28 },
  { header: "Cargo", key: "cargo", width: 20 },
  { header: "Departamento", key: "departamento", width: 22 },
  { header: "Vínculo", key: "vinculo", width: 10 },
  { header: "Líder direto", key: "liderDireto", width: 22 },
  { header: "Salário", key: "salarioBase", width: 12 },
  { header: "Alimentação", key: "alimentacaoValor", width: 12 },
  { header: "CBO", key: "cbo", width: 10 },
  { header: "Cidade", key: "cidade", width: 18 },
  { header: "Agência", key: "agencia", width: 10 },
  { header: "Conta", key: "conta", width: 14 },
  { header: "Tipo de transporte", key: "tipoTransporte", width: 16 },
  { header: "Valor do transporte", key: "valorTransporteFixo", width: 16 },
];

/** Exporta o quadro completo de colaboradores — mesmas colunas do modelo de importação, já preenchidas. */
export async function GET() {
  const colaboradores = listarColaboradores();
  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Colaboradores");
  sheet.columns = COLUNAS;
  sheet.getRow(1).font = { bold: true };

  for (const c of colaboradores) {
    const lider = c.gestorId ? colaboradoresPorId.get(c.gestorId)?.nome : c.liderDiretoNome;
    sheet.addRow({
      nome: c.nome,
      dataAdmissao: c.dataAdmissao,
      dataNascimento: c.dataNascimento ?? "",
      cpf: c.cpf ?? "",
      email: c.email ?? "",
      cargo: c.cargo ?? "",
      departamento: c.departamento ?? "",
      vinculo: c.vinculo ?? "",
      liderDireto: lider ?? "",
      salarioBase: c.salarioBase,
      alimentacaoValor: c.alimentacaoValor ?? "",
      cbo: c.cbo ?? "",
      cidade: c.cidade ?? "",
      agencia: c.agencia ?? "",
      conta: c.conta ?? "",
      tipoTransporte: c.tipoTransporte === "vm_fixo" ? "VM - fixo mensal" : "VT - por dia útil",
      valorTransporteFixo: c.valorTransporteFixo ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const dataHoje = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores-${dataHoje}.xlsx"`,
    },
  });
}
