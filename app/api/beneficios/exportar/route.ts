import ExcelJS from "exceljs";
import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { editaColaboradores } from "@/lib/auth/perfil";
import { gerarRateio } from "@/lib/db/beneficiosRateio";
import { comporPorSetor, totalBrindes, type ComposicaoSetor } from "@/lib/beneficios/composicaoSetor";

export const runtime = "nodejs";

const schema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MOEDA = '"R$" #,##0.00';

/**
 * Exporta a composição dos benefícios por setor (a mesma do dashboard) de um
 * mês ou do ano todo. Um mês gera uma aba; o ano gera um resumo mais uma aba
 * por mês com rateio. É relatório do RH, como o export do Breakdown.
 */
export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!editaColaboradores(sessao)) {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse({ ano: searchParams.get("ano"), mes: searchParams.get("mes") ?? undefined });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?ano=AAAA e, opcionalmente, &mes=1-12." }, { status: 400 });
  }
  const { ano, mes } = parsed.data;
  const mesesDoArquivo = mes ? [mes] : Array.from({ length: 12 }, (_, i) => i + 1);

  const meses: { mes: number; setores: ComposicaoSetor[]; porDepartamento: Map<string, ComposicaoSetor> }[] = [];
  for (const m of mesesDoArquivo) {
    const { linhas } = await gerarRateio(`${ano}-${String(m).padStart(2, "0")}`);
    if (linhas.length === 0 && !mes) continue;

    const porDepartamento = new Map<string, ComposicaoSetor>();
    for (const l of linhas) {
      const dep = l.departamento?.trim() || "(sem setor)";
      const a = porDepartamento.get(dep) ?? { setor: "Administrativo" as const, colaboradores: 0, vt: 0, vm: 0, vr: 0, variaveis: 0, total: 0 };
      const ehVm = l.tipoTransporte === "vm_fixo";
      a.colaboradores += 1;
      a.vt += ehVm ? 0 : l.valeTransporte;
      a.vm += ehVm ? l.valeTransporte : 0;
      a.vr += l.valeAlimentacao;
      a.variaveis += l.variaveis + totalBrindes(l);
      a.total = a.vt + a.vm + a.vr + a.variaveis;
      porDepartamento.set(dep, a);
    }
    meses.push({ mes: m, setores: comporPorSetor(linhas), porDepartamento });
  }

  const workbook = new ExcelJS.Workbook();

  if (!mes) {
    const resumo = workbook.addWorksheet(`Resumo ${ano}`);
    const cab = ["Mês"];
    for (const setor of ["Produção", "Administrativo"]) {
      cab.push(`${setor} · pessoas`, `${setor} · VT`, `${setor} · VM`, `${setor} · VR`, `${setor} · Variáveis`, `${setor} · Total`);
    }
    cab.push("Total geral");
    const header = resumo.addRow(cab);
    header.font = { bold: true };
    for (const item of meses) {
      const linha: (string | number)[] = [`${MESES[item.mes - 1]}/${ano}`];
      let geral = 0;
      for (const s of item.setores) {
        linha.push(s.colaboradores, s.vt, s.vm, s.vr, s.variaveis, s.total);
        geral += s.total;
      }
      linha.push(geral);
      resumo.addRow(linha);
    }
    const totais: (string | number)[] = ["Total do ano"];
    for (let c = 2; c <= cab.length; c++) {
      const eh = (c - 2) % 6 === 0 && c < cab.length; // coluna "pessoas": não soma
      totais.push(eh ? "" : resumo.getColumn(c).values.slice(2).reduce<number>((acc, v) => acc + (typeof v === "number" ? v : 0), 0));
    }
    const rodape = resumo.addRow(totais);
    rodape.font = { bold: true };
    resumo.columns.forEach((col, i) => {
      col.width = i === 0 ? 18 : 16;
      if (i > 0) col.numFmt = MOEDA;
    });
    for (const c of [2, 8]) resumo.getColumn(c).numFmt = "0";
  }

  for (const item of meses) {
    const nomeMes = `${MESES[item.mes - 1]}/${ano}`;
    const sheet = workbook.addWorksheet(nomeMes.replace("/", "-"));
    sheet.getColumn(1).width = 26;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 26;
    sheet.getColumn(5).width = 18;

    sheet.getCell("A1").value = "Composição dos benefícios por setor";
    sheet.getCell("A1").font = { bold: true, size: 13 };
    sheet.getCell("A2").value =
      `rateado por headcount · ${item.setores.map((s) => `${s.colaboradores} ${s.setor}`).join(" · ")} · ${nomeMes}`;
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

    item.setores.forEach((s, i) => {
      const col = i === 0 ? 1 : 4;
      sheet.getCell(4, col).value = `${s.setor} · ${s.colaboradores} colaboradores`;
      sheet.getCell(4, col).font = { bold: true };
      const itens: [string, number][] = [
        ["Vale-transporte", s.vt],
        ["Vale-mobilidade", s.vm],
        ["Vale-refeição", s.vr],
        ["Variáveis", s.variaveis],
      ];
      itens.forEach(([rotulo, valor], r) => {
        sheet.getCell(5 + r, col).value = rotulo;
        sheet.getCell(5 + r, col + 1).value = valor;
        sheet.getCell(5 + r, col + 1).numFmt = MOEDA;
      });
      sheet.getCell(9, col).value = "Total";
      sheet.getCell(9, col + 1).value = s.total;
      sheet.getCell(9, col + 1).numFmt = MOEDA;
      sheet.getCell(9, col).font = { bold: true };
      sheet.getCell(9, col + 1).font = { bold: true };
      for (const c of [col, col + 1]) sheet.getCell(9, c).border = { top: { style: "thin" } };
    });

    // Valor por setor real do cadastro, como o "Ver valor por setor" da tela.
    let linha = 12;
    sheet.getCell(linha, 1).value = "Valor por setor";
    sheet.getCell(linha, 1).font = { bold: true };
    linha += 1;
    const cabecalho = ["Setor", "Pessoas", "Vale-transporte", "Vale-mobilidade", "Vale-refeição", "Variáveis", "Total"];
    cabecalho.forEach((t, i) => {
      const c = sheet.getCell(linha, i + 1);
      c.value = t;
      c.font = { bold: true };
    });
    for (const [dep, v] of Array.from(item.porDepartamento.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      linha += 1;
      [dep, v.colaboradores, v.vt, v.vm, v.vr, v.variaveis, v.total].forEach((valor, i) => {
        const c = sheet.getCell(linha, i + 1);
        c.value = valor;
        if (i >= 2) c.numFmt = MOEDA;
      });
    }
    [6, 7].forEach((c) => (sheet.getColumn(c).width = 16));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const nome = mes ? `rateio-beneficios-${ano}-${String(mes).padStart(2, "0")}.xlsx` : `rateio-beneficios-${ano}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
