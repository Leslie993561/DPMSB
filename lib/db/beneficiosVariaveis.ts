import "server-only";
import { getDb } from "./client";
import { listarColaboradores } from "./colaboradores";
import { arredondar } from "@/lib/calc";

export type CategoriaVariavel = "transporte" | "mobilidade" | "alimentacao";

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
