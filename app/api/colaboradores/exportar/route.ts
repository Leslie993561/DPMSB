import ExcelJS from "exceljs";
import { listarColaboradores } from "@/lib/db/colaboradores";
import { listarDependentesPorColaborador } from "@/lib/db/colaboradorDependentes";
import { COLUNAS_COLABORADOR, colunasDependentes } from "@/lib/planilhas/colunasColaborador";
import { nomeParaPlanilha, padronizarColunaDeNome } from "@/lib/planilhas/nomeColaborador";

export const runtime = "nodejs";

const ROTULO_SEXO: Record<string, string> = { M: "Masculino", F: "Feminino" };

/** Exporta o quadro completo de colaboradores — todos os campos da ficha, na mesma ordem dos blocos. */
export async function GET() {
  const [colaboradores, dependentesPorColaborador] = await Promise.all([
    listarColaboradores(),
    listarDependentesPorColaborador(),
  ]);
  const colaboradoresPorId = new Map(colaboradores.map((c) => [c.id, c]));
  const maiorQuantidadeDependentes = colaboradores.reduce(
    (maior, c) => Math.max(maior, dependentesPorColaborador.get(c.id)?.length ?? 0),
    0,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Colaboradores");
  sheet.columns = [...COLUNAS_COLABORADOR, ...colunasDependentes(maiorQuantidadeDependentes)];
  sheet.getRow(1).font = { bold: true };

  for (const c of colaboradores) {
    const lider = c.gestorId ? colaboradoresPorId.get(c.gestorId)?.nome : c.liderDiretoNome;
    const dependentes = dependentesPorColaborador.get(c.id) ?? [];
    const colunasDep: Record<string, string> = {};
    dependentes.forEach((d, i) => {
      const n = i + 1;
      colunasDep[`dep${n}Nome`] = d.nome;
      colunasDep[`dep${n}Nascimento`] = d.dataNascimento ?? "";
      colunasDep[`dep${n}Cpf`] = d.cpf ?? "";
    });

    sheet.addRow({
      nome: nomeParaPlanilha(c.nome),
      cpf: c.cpf ?? "",
      pis: c.pis ?? "",
      dataNascimento: c.dataNascimento ?? "",
      cidadeNascimento: c.cidadeNascimento ?? "",
      ufNascimento: c.ufNascimento ?? "",
      nomePai: c.nomePai ?? "",
      nomeMae: c.nomeMae ?? "",
      telefone: c.telefone ?? "",
      sexo: c.sexo ? ROTULO_SEXO[c.sexo] : "",
      emailPessoal: c.emailPessoal ?? "",
      email: c.email ?? "",
      cargo: c.cargo ?? "",
      departamento: c.departamento ?? "",
      vinculo: c.vinculo ?? "",
      cbo: c.cbo ?? "",
      liderDireto: lider ?? "",
      salarioBase: c.salarioBase,
      horario: c.horario ?? "",
      dataAdmissao: c.dataAdmissao,
      dataDesligamento: c.dataDesligamento ?? "",
      banco: c.banco ?? "",
      agencia: c.agencia ?? "",
      conta: c.conta ?? "",
      alimentacaoValor: c.alimentacaoValor ?? "",
      tipoTransporte: c.tipoTransporte === "vm_fixo" ? "VM - fixo mensal" : "VT - por dia útil",
      // A coluna é uma só porque cada pessoa tem um tipo de transporte só; o
      // valor que sai é o da coluna correspondente ao tipo dela.
      valorTransporte: (c.tipoTransporte === "vm_fixo" ? c.valorTransporteFixo : c.valorTransporteDia) ?? "",
      cep: c.cep ?? "",
      estado: c.estado ?? "",
      cidade: c.cidade ?? "",
      bairro: c.bairro ?? "",
      rua: c.rua ?? "",
      numero: c.numero ?? "",
      conjugeNome: c.conjugeNome ?? "",
      conjugeCpf: c.conjugeCpf ?? "",
      conjugeNascimento: c.conjugeNascimento ?? "",
      ...colunasDep,
    });
  }

  padronizarColunaDeNome(sheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const dataHoje = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="colaboradores-${dataHoje}.xlsx"`,
    },
  });
}
