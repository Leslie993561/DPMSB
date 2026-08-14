import "server-only";
import { getDb } from "./client";

/** Contagem de dias úteis (segunda a sexta) do mês — estimativa inicial editável pelo DP, sem considerar feriados locais. */
export function diasUteisPadrao(ano: number, mes: number): number {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  let dias = 0;
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

interface LinhaDiasUteis {
  ano: number;
  mes: number;
  dias_uteis: number;
}

/**
 * Dias úteis efetivos do mês: usa o último valor definido em `mes` ou em
 * qualquer mês anterior (o ajuste "vale a partir deste mês em diante", não só
 * para o mês em que foi lançado); sem nenhum ajuste anterior, cai no cálculo
 * padrão do calendário daquele mês específico.
 */
export function obterDiasUteis(ano: number, mes: number): number {
  const linha = getDb()
    .prepare(
      `SELECT dias_uteis FROM beneficios_dias_uteis
       WHERE ano < ? OR (ano = ? AND mes <= ?)
       ORDER BY ano DESC, mes DESC
       LIMIT 1`,
    )
    .get(ano, ano, mes) as { dias_uteis: number } | undefined;
  return linha?.dias_uteis ?? diasUteisPadrao(ano, mes);
}

/**
 * Visão do ano para a grade editável: `ajustado` = tem lançamento próprio
 * nesse mês; `herdado` = usa o valor de um ajuste de mês anterior (em
 * diante); `padrao` = nenhum ajuste encontrado, cálculo de calendário.
 */
export function listarDiasUteisAno(
  ano: number,
): { mes: number; diasUteis: number; origem: "ajustado" | "herdado" | "padrao" }[] {
  const linhasAno = getDb()
    .prepare("SELECT * FROM beneficios_dias_uteis WHERE ano = ?")
    .all(ano) as unknown as LinhaDiasUteis[];
  const ajustados = new Map(linhasAno.map((l) => [l.mes, l.dias_uteis]));

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    if (ajustados.has(mes)) {
      return { mes, diasUteis: ajustados.get(mes)!, origem: "ajustado" as const };
    }
    const efetivo = obterDiasUteis(ano, mes);
    const padrao = diasUteisPadrao(ano, mes);
    return { mes, diasUteis: efetivo, origem: efetivo === padrao ? ("padrao" as const) : ("herdado" as const) };
  });
}

/** Define os dias úteis a partir deste mês — vale para este e para todos os meses seguintes que não tenham ajuste próprio. */
export function definirDiasUteis(ano: number, mes: number, diasUteis: number): void {
  getDb()
    .prepare(
      `INSERT INTO beneficios_dias_uteis (ano, mes, dias_uteis) VALUES (?, ?, ?)
       ON CONFLICT(ano, mes) DO UPDATE SET dias_uteis = excluded.dias_uteis`,
    )
    .run(ano, mes, diasUteis);
}
