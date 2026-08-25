import ExcelJS from "exceljs";

export const runtime = "nodejs";

/**
 * O modelo espelha o Relatório detalhado coluna por coluna, nos mesmos cinco
 * grupos, para quem preenche não precisar traduzir nada de uma tela para a
 * outra.
 *
 * O nome do grupo entra no PRÓPRIO cabeçalho ("Encargos · INSS") em vez de uma
 * linha mesclada acima: a leitura de planilha usa a primeira linha como
 * cabeçalho, e um banner de grupo acima dela faria o modelo não ser aceito pela
 * própria importação. O casamento de colunas é por palavra inteira, então o
 * prefixo do grupo não estorva.
 *
 * Metade das colunas o portal CALCULA — INSS, FGTS, provisão de 13º, VT, VA,
 * salário família e os adicionais saem do motor determinístico e do cadastro,
 * nunca de planilha. Aparecem aqui para o arquivo ter a mesma cara do
 * relatório; a importação as ignora de propósito, e por isso vêm em cinza,
 * com a aba "Como preencher" explicando coluna por coluna. Se fossem
 * importáveis, uma planilha errada passaria a valer mais que o cálculo legal.
 */
type Origem = "importada" | "calculada";

interface ColunaModelo {
  titulo: string;
  key: string;
  width: number;
  grupo: string;
  origem: Origem;
}

const COLUNAS: ColunaModelo[] = [
  { titulo: "Código", key: "codigo", width: 10, grupo: "Identificação", origem: "importada" },
  { titulo: "Nome do colaborador", key: "nome", width: 32, grupo: "Identificação", origem: "importada" },

  { titulo: "INSS", key: "inss", width: 16, grupo: "Encargos", origem: "calculada" },
  { titulo: "FGTS", key: "fgts", width: 16, grupo: "Encargos", origem: "calculada" },
  { titulo: "Provisão 13º", key: "provisao13", width: 20, grupo: "Encargos", origem: "calculada" },
  { titulo: "Total encargos", key: "totalEncargos", width: 22, grupo: "Encargos", origem: "calculada" },

  { titulo: "VT", key: "vt", width: 16, grupo: "Benefícios", origem: "calculada" },
  { titulo: "VA", key: "va", width: 16, grupo: "Benefícios", origem: "calculada" },
  { titulo: "VM", key: "vm", width: 16, grupo: "Benefícios", origem: "importada" },
  { titulo: "Odontológico", key: "odontologico", width: 22, grupo: "Benefícios", origem: "importada" },
  { titulo: "Salário família", key: "salarioFamilia", width: 24, grupo: "Benefícios", origem: "calculada" },

  { titulo: "Sólides", key: "solides", width: 18, grupo: "Plataformas", origem: "importada" },
  { titulo: "Flash", key: "flash", width: 18, grupo: "Plataformas", origem: "importada" },

  { titulo: "Hora extra 50%", key: "horaExtra50", width: 24, grupo: "Hora extra", origem: "importada" },
  { titulo: "Hora extra 100%", key: "horaExtra100", width: 25, grupo: "Hora extra", origem: "importada" },
  { titulo: "Desconto de horas", key: "descontoHoras", width: 26, grupo: "Hora extra", origem: "importada" },
  { titulo: "Hora noturna", key: "horaNoturna", width: 23, grupo: "Hora extra", origem: "importada" },
  // As quatro acima recebem HORAS (08:01), não reais — ver a aba "Como preencher".

  { titulo: "Premiação", key: "premiacao", width: 18, grupo: "Outros", origem: "importada" },
  { titulo: "Bonificação", key: "bonificacao", width: 19, grupo: "Outros", origem: "importada" },
  { titulo: "Periculosidade", key: "periculosidade", width: 22, grupo: "Outros", origem: "calculada" },
  { titulo: "Insalubridade", key: "insalubridade", width: 21, grupo: "Outros", origem: "calculada" },
  { titulo: "Adicional fixo", key: "adicionalFixo", width: 22, grupo: "Outros", origem: "calculada" },
];

/** Uma cor por grupo, iguais às faixas do relatório na tela. */
const COR_GRUPO: Record<string, string> = {
  Identificação: "FFEFF3F5",
  Encargos: "FFFDF7EA",
  Benefícios: "FFE4EEF1",
  Plataformas: "FFEAF1F3",
  "Hora extra": "FFF0EDF6",
  Outros: "FFE9EEF1",
};

const CINZA_CALCULADA = "FFDDE3E6";

function cabecalho(coluna: ColunaModelo): string {
  return coluna.grupo === "Identificação" ? coluna.titulo : `${coluna.grupo} · ${coluna.titulo}`;
}

/** Modelo baixável para a importação de verbas do Relatório detalhado (Breakdown de Folha). */
export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Verbas do mês");

  sheet.columns = COLUNAS.map((c) => ({ header: cabecalho(c), key: c.key, width: c.width }));

  const linhaHeader = sheet.getRow(1);
  linhaHeader.height = 28;
  COLUNAS.forEach((coluna, i) => {
    const celula = linhaHeader.getCell(i + 1);
    celula.font = {
      bold: true,
      size: 10,
      color: { argb: coluna.origem === "calculada" ? "FF7A8A93" : "FF1B2A32" },
    };
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: coluna.origem === "calculada" ? CINZA_CALCULADA : COR_GRUPO[coluna.grupo] },
    };
    celula.alignment = { wrapText: true, vertical: "middle" };
  });

  const exemplos: Record<string, string | number>[] = [
    { codigo: "63", nome: "Alice Coutinho da Cruz", odontologico: 65, horaExtra50: "08:01" },
    { codigo: "64", nome: "Ana Beatriz Souza Figueiredo", vm: 166.74, odontologico: 65, solides: 60, horaNoturna: "02:30" },
  ];
  for (const exemplo of exemplos) {
    const linha: Record<string, string | number> = {};
    for (const coluna of COLUNAS) {
      if (coluna.origem === "calculada") continue;
      linha[coluna.key] = exemplo[coluna.key] ?? (coluna.key === "codigo" || coluna.key === "nome" ? "" : 0);
    }
    sheet.addRow(linha);
  }

  // As instruções vão em uma ABA SEPARADA, não abaixo dos dados: a leitura
  // trata cada linha após o cabeçalho como um colaborador, e o texto da
  // legenda acabava relatado como "colaborador não encontrado no cadastro".
  const ajuda = workbook.addWorksheet("Como preencher");
  ajuda.columns = [{ width: 24 }, { width: 90 }];
  ajuda.addRow(["Coluna", "Como o portal trata"]);
  ajuda.getRow(1).font = { bold: true };
  for (const coluna of COLUNAS) {
    const linha = ajuda.addRow([
      cabecalho(coluna),
      coluna.origem === "importada"
        ? "Preenchida por você — é lida da planilha."
        : "Calculada pelo portal (motor de cálculo e cadastro do colaborador) — se vier preenchida, é ignorada.",
    ]);
    if (coluna.origem === "calculada") {
      linha.getCell(1).font = { color: { argb: "FF7A8A93" } };
      linha.getCell(2).font = { color: { argb: "FF7A8A93" } };
    }
  }
  ajuda.addRow([]);
  ajuda.addRow([
    "Hora extra e afins",
    'As quatro colunas de "Hora extra" recebem HORAS, não reais: escreva 08:01 para oito horas e um minuto. ' +
      "O portal calcula o valor pelo salário — 50% vale 1,5× a hora normal, 100% vale 2×, e hora noturna soma o " +
      "adicional de 20% (a hora em si já está no salário).",
  ]);
  ajuda.addRow(["Desconto de horas", "Informe positivo, também em horas: o portal subtrai do custo do colaborador."]);
  ajuda.addRow(["Coluna desconhecida", 'Entra somada na coluna "Outros custos" do relatório, nunca é descartada.']);
  ajuda.addRow(["Casamento", "Por código quando houver; senão pelo nome do colaborador."]);

  // Congela o cabeçalho e as duas colunas de identificação.
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-verbas-folha.xlsx"',
    },
  });
}
