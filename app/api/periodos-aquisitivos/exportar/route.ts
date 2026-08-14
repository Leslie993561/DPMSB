import ExcelJS from "exceljs";
import { listarHistoricoColaborador, listarPeriodosAbertos } from "@/lib/db/periodosAquisitivos";
import { listarColaboradores } from "@/lib/db/colaboradores";
import { formatarDataBr } from "@/lib/format";

export const runtime = "nodejs";

const ROTULO_SITUACAO: Record<string, string> = {
  vencida: "Vencido",
  a_vencer: "Em aberto",
  programada: "Programada",
};

/**
 * Exporta o Controle de Férias em três recortes possíveis:
 * - `colaborador`: histórico completo (todos os períodos, não só os em aberto) de um único empregado.
 * - `setor`: só as linhas do setor informado, entre os períodos em aberto.
 * - `trimestre`: só as linhas cujo vencimento (concessivoFim) cai no Q informado de um ano.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");

  const workbook = new ExcelJS.Workbook();
  let nomeArquivo = "controle-de-ferias.xlsx";

  if (tipo === "colaborador") {
    const colaboradorId = Number(searchParams.get("colaboradorId"));
    const colaborador = listarColaboradores().find((c) => c.id === colaboradorId);
    if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

    const historico = listarHistoricoColaborador(colaboradorId);
    const sheet = workbook.addWorksheet("Histórico");
    sheet.columns = [
      { header: "Período aquisitivo", key: "aquisitivo", width: 24 },
      { header: "Período concessivo", key: "concessivo", width: 24 },
      { header: "Dias de direito", key: "direito", width: 14 },
      { header: "Dias gozados", key: "gozados", width: 12 },
      { header: "Dias restantes", key: "restantes", width: 14 },
      { header: "Limite p/ gozo", key: "limite", width: 14 },
      { header: "Abono", key: "abono", width: 10 },
      { header: "Situação", key: "situacao", width: 14 },
      { header: "Alerta", key: "alerta", width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const p of historico) {
      sheet.addRow({
        aquisitivo: `${formatarDataBr(p.dataInicio)} – ${formatarDataBr(p.dataFim)}`,
        concessivo: `${formatarDataBr(p.concessivoInicio)} – ${formatarDataBr(p.concessivoFim)}`,
        direito: p.diasDireito,
        gozados: p.diasTirados,
        restantes: p.diasATirar,
        limite: formatarDataBr(p.concessivoFim),
        abono: p.abonoUtilizado ? `${p.diasAbono} dia(s)` : "—",
        situacao: p.diasATirar <= 0 ? "Concluído" : ROTULO_SITUACAO[p.situacao],
        alerta: p.alerta ? "Sim" : "Não",
      });
    }
    nomeArquivo = `ferias-${colaborador.nome.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  } else if (tipo === "setor") {
    const setor = searchParams.get("setor") ?? "";
    const linhas = listarPeriodosAbertos().filter((p) => p.colaboradorDepartamento === setor);
    montarPlanilhaResumo(workbook, linhas);
    nomeArquivo = `ferias-${setor.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  } else if (tipo === "trimestre") {
    const trimestre = Number(searchParams.get("trimestre"));
    const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
    const linhas = listarPeriodosAbertos().filter(
      (p) =>
        Number(p.concessivoFim.slice(0, 4)) === ano &&
        Math.ceil(Number(p.concessivoFim.slice(5, 7)) / 3) === trimestre,
    );
    montarPlanilhaResumo(workbook, linhas);
    nomeArquivo = `ferias-q${trimestre}-${ano}.xlsx`;
  } else {
    return Response.json({ erro: "Informe um tipo de exportação válido (colaborador, setor ou trimestre)." }, { status: 400 });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}

function montarPlanilhaResumo(workbook: ExcelJS.Workbook, linhas: ReturnType<typeof listarPeriodosAbertos>) {
  const sheet = workbook.addWorksheet("Resumo");
  sheet.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Admissão", key: "admissao", width: 14 },
    { header: "Período aquisitivo", key: "aquisitivo", width: 24 },
    { header: "Período concessivo", key: "concessivo", width: 24 },
    { header: "Dias gozados", key: "gozados", width: 12 },
    { header: "Dias restantes", key: "restantes", width: 14 },
    { header: "Limite p/ gozo (vencimento)", key: "vencimento", width: 20 },
    { header: "Situação", key: "situacao", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const p of linhas) {
    sheet.addRow({
      nome: p.colaboradorNome,
      admissao: formatarDataBr(p.colaboradorAdmissao),
      aquisitivo: `${formatarDataBr(p.dataInicio)} – ${formatarDataBr(p.dataFim)}`,
      concessivo: `${formatarDataBr(p.concessivoInicio)} – ${formatarDataBr(p.concessivoFim)}`,
      gozados: p.diasTirados,
      restantes: p.diasATirar,
      vencimento: formatarDataBr(p.concessivoFim),
      situacao: ROTULO_SITUACAO[p.situacao],
    });
  }
}
