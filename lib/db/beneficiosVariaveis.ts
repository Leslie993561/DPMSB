import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { arredondar } from "@/lib/calc";
import { estaNaFolha } from "@/lib/folha/vigencia";

export type CategoriaVariavel = "transporte" | "mobilidade" | "alimentacao" | "aniversario";

/**
 * Presente de aniversário, por pessoa que faz aniversário no mês.
 *
 * Não é importado: sai da data de nascimento do Quadro de Colaboradores, que já
 * é a fonte da informação. Lançar por planilha significaria manter a mesma lista
 * em dois lugares e esquecer alguém sempre que entrasse gente nova.
 */
export const VALOR_ANIVERSARIO = 70;

export interface ItemVariavel {
  categoria: CategoriaVariavel;
  valor: number;
  motivo: string | null;
  arquivo: string | null;
}

export interface VariaveisColaborador {
  total: number;
  itens: ItemVariavel[];
}

interface LinhaVariavel {
  colaborador_id: number;
  categoria: CategoriaVariavel;
  valor: number;
  motivo: string | null;
  arquivo: string | null;
}

/** Variáveis lançadas na competência, por colaborador — cada importação SOMA linhas novas, nunca substitui as anteriores. */
export async function obterVariaveis(competencia: string): Promise<Map<number, VariaveisColaborador>> {
  const db = await getDb();
  const mesCompetencia = Number(competencia.slice(5, 7));
  const resultado = await db.execute({
    sql: "SELECT colaborador_id, categoria, valor, motivo, arquivo FROM beneficios_variaveis WHERE competencia = ? ORDER BY criado_em",
    args: [competencia],
  });
  const linhas = resultado.rows as unknown as LinhaVariavel[];

  const mapa = new Map<number, VariaveisColaborador>();
  for (const l of linhas) {
    const atual = mapa.get(l.colaborador_id) ?? { total: 0, itens: [] };
    atual.total = arredondar(atual.total + l.valor);
    atual.itens.push({ categoria: l.categoria, valor: l.valor, motivo: l.motivo, arquivo: l.arquivo });
    mapa.set(l.colaborador_id, atual);
  }

  // Aniversariantes do mês, direto do cadastro. Só entra quem está na folha
  // dessa competência: quem foi admitido depois, ou já saiu, não recebe o
  // presente de um mês em que não estava na empresa.
  for (const c of await listarColaboradores()) {
    if (!c.dataNascimento) continue;
    if (Number(c.dataNascimento.slice(5, 7)) !== mesCompetencia) continue;
    if (!estaNaFolha(c, competencia)) continue;

    const atual = mapa.get(c.id) ?? { total: 0, itens: [] };
    atual.total = arredondar(atual.total + VALOR_ANIVERSARIO);
    atual.itens.push({
      categoria: "aniversario",
      valor: VALOR_ANIVERSARIO,
      motivo: `Aniversário em ${c.dataNascimento.slice(8, 10)}/${c.dataNascimento.slice(5, 7)}`,
      arquivo: null,
    });
    mapa.set(c.id, atual);
  }

  return mapa;
}

export interface LinhaImportacaoVariavel {
  codigo: string | null;
  nomeColaborador: string;
  transporte: number | null;
  mobilidade: number | null;
  alimentacao: number | null;
  motivo: string | null;
}

export interface ResultadoImportacaoVariaveis {
  aplicadas: number;
  descartados: { linha: number; motivo: string }[];
}

/** Cada linha da planilha vira uma ou mais linhas novas em `beneficios_variaveis` — soma com o que já existia, nunca sobrescreve. */
export async function importarVariaveis(
  itens: LinhaImportacaoVariavel[],
  competencia: string,
  nomeArquivo: string,
): Promise<ResultadoImportacaoVariaveis> {
  const colaboradores = await listarColaboradores();
  const porCodigo = new Map(colaboradores.map((c) => [String(c.id), c]));
  const porNome = new Map(colaboradores.map((c) => [c.nome.trim().toLowerCase(), c]));
  const db = await getDb();

  let aplicadas = 0;
  const descartados: ResultadoImportacaoVariaveis["descartados"] = [];
  const inserts: { sql: string; args: (string | number | null)[] }[] = [];

  itens.forEach((item, indice) => {
    const linha = indice + 2;
    const colaborador =
      (item.codigo ? porCodigo.get(item.codigo.trim()) : undefined) ??
      porNome.get(item.nomeColaborador.trim().toLowerCase());

    if (!colaborador) {
      descartados.push({ linha, motivo: `Colaborador "${item.nomeColaborador}" não encontrado no cadastro.` });
      return;
    }

    const categorias: { categoria: CategoriaVariavel; valor: number | null }[] = [
      { categoria: "transporte", valor: item.transporte },
      { categoria: "mobilidade", valor: item.mobilidade },
      { categoria: "alimentacao", valor: item.alimentacao },
    ];
    let algumaAplicada = false;
    for (const { categoria, valor } of categorias) {
      if (valor === null || valor === 0) continue;
      inserts.push({
        sql: `INSERT INTO beneficios_variaveis (colaborador_id, competencia, categoria, valor, motivo, arquivo)
     VALUES (?, ?, ?, ?, ?, ?)`,
        args: [colaborador.id, competencia, categoria, valor, item.motivo, nomeArquivo],
      });
      algumaAplicada = true;
    }

    if (!algumaAplicada) {
      descartados.push({ linha, motivo: `Nenhum valor de transporte, mobilidade ou alimentação em "${item.nomeColaborador}".` });
      return;
    }
    aplicadas++;
  });

  if (inserts.length > 0) await db.batch(inserts, "write");

  return { aplicadas, descartados };
}
