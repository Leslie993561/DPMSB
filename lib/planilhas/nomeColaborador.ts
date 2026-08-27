import type ExcelJS from "exceljs";

/**
 * Fonte única dos nomes de colaborador nas planilhas exportadas.
 *
 * O cadastro tem grafias misturadas — "Alice Coutinho Da Cruz" convive com
 * "TAIS BATISTA SANTOS", herança da planilha-mestre. Na tela isso é resolvido
 * exibindo tudo em caixa alta; nas planilhas cada rota resolvia por conta
 * própria, ou não resolvia, e o mesmo nome saía de um jeito em cada arquivo.
 */
export const FONTE_NOME_COLABORADOR = { name: "Calibri", size: 11 } as const;

/** Nome como ele deve sair em qualquer planilha: caixa alta, sem espaço sobrando. */
export function nomeParaPlanilha(nome: string | null | undefined): string {
  return (nome ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Aplica a fonte padrão à coluna de nomes, pulando o cabeçalho (que tem estilo
 * próprio, em negrito).
 */
export function padronizarColunaDeNome(sheet: ExcelJS.Worksheet, chave = "nome"): void {
  const coluna = sheet.getColumn(chave);
  if (!coluna) return;
  coluna.eachCell({ includeEmpty: false }, (cell, numeroLinha) => {
    if (numeroLinha === 1) return;
    cell.font = { ...FONTE_NOME_COLABORADOR };
  });
}
