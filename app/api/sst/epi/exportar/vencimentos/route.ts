import ExcelJS from "exceljs";
import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarProjecaoVencimentosEpi } from "@/lib/sst/epi";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("mensal"), ano: z.coerce.number().int().min(2000).max(2100), mes: z.coerce.number().int().min(1).max(12) }),
  z.object({ modo: z.literal("anual"), ano: z.coerce.number().int().min(2000).max(2100) }),
]);

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "DD/MM/AAAA" → { ano, mes } (mes 1-12); null se inválida. */
function anoMes(dataBr: string): { ano: number; mes: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  return m ? { ano: Number(m[3]), mes: Number(m[2]) } : null;
}

/**
 * Exporta a projeção de quais EPIs vão vencer — "Opção 2" do popover de
 * exportar. `modo=mensal` traz só o mês/ano escolhido; `modo=anual` traz o
 * ano inteiro, com uma coluna de mês pro RH agrupar/filtrar na planilha.
 */
export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({
    modo: searchParams.get("modo"),
    ano: searchParams.get("ano"),
    mes: searchParams.get("mes") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?modo=mensal&ano=AAAA&mes=MM ou ?modo=anual&ano=AAAA." }, { status: 400 });
  }

  const todas = await listarProjecaoVencimentosEpi();
  const filtradas = todas.filter((l) => {
    const data = anoMes(l.dataTroca);
    if (!data || data.ano !== parsed.data.ano) return false;
    return parsed.data.modo === "anual" || data.mes === parsed.data.mes;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vencimentos");
  const colunaMes = parsed.data.modo === "anual" ? [{ header: "Mês", key: "mes", width: 12 }] : [];
  sheet.columns = [
    ...colunaMes,
    { header: "Colaborador", key: "nome", width: 32 },
    { header: "Cargo", key: "cargo", width: 22 },
    { header: "Departamento", key: "departamento", width: 22 },
    { header: "EPI", key: "epi", width: 26 },
    { header: "Troca prevista", key: "dataTroca", width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const l of filtradas) {
    const data = anoMes(l.dataTroca);
    sheet.addRow({
      mes: data ? MESES[data.mes - 1] : "",
      nome: l.nome,
      cargo: l.cargo ?? "",
      departamento: l.departamento ?? "",
      epi: l.epi,
      dataTroca: l.dataTroca,
    });
  }

  const sufixo = parsed.data.modo === "anual" ? `${parsed.data.ano}` : `${String(parsed.data.mes).padStart(2, "0")}-${parsed.data.ano}`;
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="epi-vencimentos-${sufixo}.xlsx"`,
    },
  });
}
