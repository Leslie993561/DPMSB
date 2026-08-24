import ExcelJS from "exceljs";
import {
  listarHistoricoColaborador,
  listarPeriodosAbertos,
  listarPeriodosEmCurso,
} from "@/lib/db/periodosAquisitivos";
import { listarHistoricoFerias } from "@/lib/db/historicoFerias";
import { listarColaboradores } from "@/lib/db/colaboradores";
import { formatarDataBr } from "@/lib/format";

export const runtime = "nodejs";

const ROTULO_STATUS_LANCAMENTO: Record<string, string> = {
  programada: "Programada",
  concluida: "Concluído",
  alterada: "Alterada",
  cancelada: "Cancelada",
};

const ROTULO_SITUACAO: Record<string, string> = {
  vencida: "Vencido",
  a_vencer: "Em aberto",
  programada: "Programada",
  concluido: "Concluído",
};

/**
 * Exporta o Controle de Férias nos recortes possíveis:
 * - `individual`: relatório completo de uma pessoa — cada período de férias já
 *   gozado, com datas e dias, mais a situação atual dos períodos dela.
 * - `situacao`: a tabela que está na tela, com todo mundo — períodos em aberto
 *   e, para quem está em dia, o período em curso.
 * - `colaborador`: histórico completo (todos os períodos, não só os em aberto) de um único empregado.
 * - `setor`: só as linhas do setor informado, entre os períodos em aberto.
 * - `trimestre`: só as linhas cujo vencimento (concessivoFim) cai no Q informado de um ano.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");

  const workbook = new ExcelJS.Workbook();
  let nomeArquivo = "controle-de-ferias.xlsx";

  if (tipo === "individual") {
    const colaboradorId = Number(searchParams.get("colaboradorId"));
    const colaborador = (await listarColaboradores()).find((c) => c.id === colaboradorId);
    if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

    await montarRelatorioIndividual(workbook, colaboradorId);
    nomeArquivo = `relatorio-ferias-${colaborador.nome.replace(/s+/g, "-").toLowerCase()}.xlsx`;
  } else if (tipo === "situacao") {
    await montarSituacaoAtual(workbook);
    nomeArquivo = "situacao-atual-ferias.xlsx";
  } else if (tipo === "colaborador") {
    const colaboradorId = Number(searchParams.get("colaboradorId"));
    const colaborador = (await listarColaboradores()).find((c) => c.id === colaboradorId);
    if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

    const historico = await listarHistoricoColaborador(colaboradorId);
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
        limite: formatarDataBr(p.limiteGozo),
        abono: p.abonoUtilizado ? `${p.diasAbono} dia(s)` : "—",
        situacao: p.diasATirar <= 0 ? "Concluído" : ROTULO_SITUACAO[p.situacao],
        alerta: p.alerta ? "Sim" : "Não",
      });
    }
    nomeArquivo = `ferias-${colaborador.nome.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  } else if (tipo === "setor") {
    const setor = searchParams.get("setor") ?? "";
    const linhas = (await listarPeriodosAbertos()).filter((p) => p.colaboradorDepartamento === setor);
    montarPlanilhaResumo(workbook, linhas);
    nomeArquivo = `ferias-${setor.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  } else if (tipo === "trimestre") {
    const trimestre = Number(searchParams.get("trimestre"));
    const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
    const linhas = (await listarPeriodosAbertos()).filter(
      (p) =>
        Number(p.concessivoFim.slice(0, 4)) === ano &&
        Math.ceil(Number(p.concessivoFim.slice(5, 7)) / 3) === trimestre,
    );
    montarPlanilhaResumo(workbook, linhas);
    nomeArquivo = `ferias-q${trimestre}-${ano}.xlsx`;
  } else {
    return Response.json(
      { erro: "Informe um tipo de exportação válido (individual, situacao, colaborador, setor ou trimestre)." },
      { status: 400 },
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}

function montarPlanilhaResumo(workbook: ExcelJS.Workbook, linhas: Awaited<ReturnType<typeof listarPeriodosAbertos>>) {
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
      vencimento: formatarDataBr(p.limiteGozo),
      situacao: ROTULO_SITUACAO[p.situacao],
    });
  }
}

/**
 * "Relatório completo individual": duas abas — todas as férias que a pessoa já
 * gozou, uma linha por lançamento, e a situação dos períodos dela hoje. As
 * datas vêm do gozo real quando existe; senão, da data prevista.
 */
async function montarRelatorioIndividual(workbook: ExcelJS.Workbook, colaboradorId: number) {
  const [historico, abertos, emCurso] = await Promise.all([
    listarHistoricoFerias(colaboradorId),
    listarPeriodosAbertos(),
    listarPeriodosEmCurso(),
  ]);

  const gozadas = workbook.addWorksheet("Férias gozadas");
  gozadas.columns = [
    { header: "Período aquisitivo", key: "aquisitivo", width: 24 },
    { header: "Período concessivo", key: "concessivo", width: 24 },
    { header: "Início das férias", key: "inicio", width: 16 },
    { header: "Fim das férias", key: "fim", width: 16 },
    { header: "Dias", key: "dias", width: 8 },
    { header: "Abono (dias)", key: "abono", width: 12 },
    { header: "Situação", key: "situacao", width: 14 },
  ];
  gozadas.getRow(1).font = { bold: true };

  for (const periodo of historico) {
    const aquisitivo = `${formatarDataBr(periodo.aquisitivoInicio)} – ${formatarDataBr(periodo.aquisitivoFim)}`;
    const concessivo = `${formatarDataBr(periodo.concessivoInicio)} – ${formatarDataBr(periodo.concessivoFim)}`;
    for (const f of periodo.ferias) {
      gozadas.addRow({
        aquisitivo,
        concessivo,
        inicio: f.inicio ? formatarDataBr(f.inicio) : "—",
        fim: f.fim ? formatarDataBr(f.fim) : "—",
        dias: f.dias,
        abono: f.diasAbono > 0 ? f.diasAbono : "—",
        situacao: ROTULO_STATUS_LANCAMENTO[f.status] ?? f.status,
      });
    }
  }

  const situacao = workbook.addWorksheet("Situação atual");
  situacao.columns = [
    { header: "Período aquisitivo", key: "aquisitivo", width: 24 },
    { header: "Período concessivo", key: "concessivo", width: 24 },
    { header: "Dias de direito", key: "direito", width: 14 },
    { header: "Dias gozados", key: "gozados", width: 12 },
    { header: "Dias restantes", key: "restantes", width: 14 },
    { header: "Limite p/ gozo", key: "limite", width: 14 },
    { header: "Situação", key: "situacao", width: 16 },
  ];
  situacao.getRow(1).font = { bold: true };

  for (const p of abertos.filter((x) => x.colaboradorId === colaboradorId)) {
    situacao.addRow({
      aquisitivo: `${formatarDataBr(p.dataInicio)} – ${formatarDataBr(p.dataFim)}`,
      concessivo: `${formatarDataBr(p.concessivoInicio)} – ${formatarDataBr(p.concessivoFim)}`,
      direito: p.diasDireito,
      gozados: p.diasTirados,
      restantes: p.diasATirar,
      limite: formatarDataBr(p.limiteGozo),
      situacao: ROTULO_SITUACAO[p.situacao],
    });
  }
  for (const e of emCurso.filter((x) => x.colaboradorId === colaboradorId)) {
    const j = e.janela;
    situacao.addRow({
      aquisitivo: j ? `${formatarDataBr(j.aquisitivoInicio)} – ${formatarDataBr(j.aquisitivoFim)}` : "—",
      concessivo: j ? `${formatarDataBr(j.concessivoInicio)} – ${formatarDataBr(j.concessivoFim)}` : "—",
      direito: j?.diasDireito ?? "—",
      gozados: j?.diasTirados ?? "—",
      restantes: j?.diasATirar ?? "—",
      limite: j ? formatarDataBr(j.limiteGozo) : "—",
      situacao: !j ? "Em dia (sem período no relatório)" : j.derivado ? "Em dia (período estimado)" : "Em dia",
    });
  }
}

/** A tabela do Controle de Férias como está na tela: todo mundo, uma linha cada. */
async function montarSituacaoAtual(workbook: ExcelJS.Workbook) {
  const [abertos, emCurso] = await Promise.all([listarPeriodosAbertos(), listarPeriodosEmCurso()]);

  const sheet = workbook.addWorksheet("Situação atual");
  sheet.columns = [
    { header: "Cód", key: "cod", width: 8 },
    { header: "Colaborador", key: "nome", width: 34 },
    { header: "Cargo", key: "cargo", width: 20 },
    { header: "Setor", key: "setor", width: 22 },
    { header: "Admissão", key: "admissao", width: 14 },
    { header: "Período aquisitivo", key: "aquisitivo", width: 24 },
    { header: "Período concessivo", key: "concessivo", width: 24 },
    { header: "Dias de direito", key: "direito", width: 14 },
    { header: "Dias gozados", key: "gozados", width: 12 },
    { header: "Dias restantes", key: "restantes", width: 14 },
    { header: "Limite p/ gozo", key: "limite", width: 14 },
    { header: "Situação", key: "situacao", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  const linhas = [
    ...abertos.map((p) => ({
      cod: p.colaboradorId,
      nome: p.colaboradorNome,
      cargo: p.colaboradorCargo ?? "—",
      setor: p.colaboradorDepartamento ?? "—",
      admissao: formatarDataBr(p.colaboradorAdmissao),
      aquisitivo: `${formatarDataBr(p.dataInicio)} – ${formatarDataBr(p.dataFim)}`,
      concessivo: `${formatarDataBr(p.concessivoInicio)} – ${formatarDataBr(p.concessivoFim)}`,
      direito: p.diasDireito,
      gozados: p.diasTirados,
      restantes: p.diasATirar,
      limite: formatarDataBr(p.limiteGozo),
      situacao: ROTULO_SITUACAO[p.situacao],
    })),
    ...emCurso.map((e) => ({
      cod: e.colaboradorId,
      nome: e.colaboradorNome,
      cargo: e.colaboradorCargo ?? "—",
      setor: e.colaboradorDepartamento ?? "—",
      admissao: formatarDataBr(e.colaboradorAdmissao),
      aquisitivo: e.janela ? `${formatarDataBr(e.janela.aquisitivoInicio)} – ${formatarDataBr(e.janela.aquisitivoFim)}` : "—",
      concessivo: e.janela ? `${formatarDataBr(e.janela.concessivoInicio)} – ${formatarDataBr(e.janela.concessivoFim)}` : "—",
      direito: e.janela?.diasDireito ?? "—",
      gozados: e.janela?.diasTirados ?? "—",
      restantes: e.janela?.diasATirar ?? "—",
      limite: e.janela ? formatarDataBr(e.janela.limiteGozo) : "—",
      situacao: !e.janela
        ? "Em dia (sem período no relatório)"
        : e.janela.derivado
          ? "Em dia (período estimado)"
          : "Em dia",
    })),
  ].sort((a, z) => a.nome.localeCompare(z.nome, "pt-BR"));

  for (const linha of linhas) sheet.addRow(linha);
}
