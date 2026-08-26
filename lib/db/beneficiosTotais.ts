import "server-only";
import { getDb } from "./client";

/**
 * Totais de benefícios informados pelo DP para um mês.
 *
 * `null` em uma verba significa "não informado" — e aí vale o valor calculado
 * pelo rateio. Zero é diferente de null: zero é uma informação ("neste mês não
 * houve"), null é a ausência dela.
 */
export interface TotaisInformados {
  vt: number | null;
  vm: number | null;
  vr: number | null;
}

export interface TotaisDoMes extends TotaisInformados {
  ano: number;
  mes: number;
}

interface LinhaTotais {
  ano: number;
  mes: number;
  vt: number | null;
  vm: number | null;
  vr: number | null;
}

/** Os totais informados do ano, indexados por mês. Mês sem registro fica de fora. */
export async function obterTotaisInformados(ano: number): Promise<Map<number, TotaisInformados>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT ano, mes, vt, vm, vr FROM beneficios_totais_mes WHERE ano = ?",
    args: [ano],
  });
  const linhas = resultado.rows as unknown as LinhaTotais[];
  return new Map(linhas.map((l) => [l.mes, { vt: l.vt, vm: l.vm, vr: l.vr }]));
}

/**
 * Grava (ou substitui) os totais de um mês.
 *
 * Verba com `undefined` fica como estava; passar `null` é o jeito de dizer
 * "esqueça o que eu informei, volte a usar o calculado".
 */
export async function definirTotaisDoMes(
  ano: number,
  mes: number,
  totais: Partial<TotaisInformados>,
): Promise<void> {
  const db = await getDb();
  const campos = (["vt", "vm", "vr"] as const).filter((c) => totais[c] !== undefined);
  if (campos.length === 0) return;

  const colunas = campos.join(", ");
  const marcadores = campos.map(() => "?").join(", ");
  const atualizacoes = campos.map((c) => `${c} = excluded.${c}`).join(", ");

  await db.execute({
    sql: `INSERT INTO beneficios_totais_mes (ano, mes, ${colunas})
       VALUES (?, ?, ${marcadores})
       ON CONFLICT(ano, mes) DO UPDATE SET ${atualizacoes}`,
    args: [ano, mes, ...campos.map((c) => totais[c] ?? null)],
  });
}

/** Lista o ano inteiro para a grade editável, com os meses sem informação também. */
export async function listarTotaisAno(ano: number): Promise<TotaisDoMes[]> {
  const informados = await obterTotaisInformados(ano);
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const t = informados.get(mes);
    return { ano, mes, vt: t?.vt ?? null, vm: t?.vm ?? null, vr: t?.vr ?? null };
  });
}
