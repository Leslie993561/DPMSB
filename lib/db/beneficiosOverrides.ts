import "server-only";
import { getDb } from "./client";

/**
 * Valores de benefício informados na planilha de rateio, por competência.
 *
 * Vive fora de `beneficiosRateio` porque o Breakdown de Folha também precisa
 * deles — e `beneficiosRateio` já importa o Breakdown. Sem esta separação os
 * dois módulos se importariam em ciclo, ou o Breakdown teria de recalcular o
 * benefício por conta própria e voltar a discordar da tela de Benefícios.
 */
export interface OverrideRateio {
  valeTransporte: number | null;
  valeAlimentacao: number | null;
  variaveis: number | null;
}

interface LinhaOverride {
  colaborador_id: number;
  vale_transporte: number | null;
  vale_alimentacao: number | null;
  variaveis: number | null;
}

export async function obterOverridesRateio(competencia: string): Promise<Map<number, OverrideRateio>> {
  const db = await getDb();
  const resultado = await db.execute({
    sql: "SELECT colaborador_id, vale_transporte, vale_alimentacao, variaveis FROM beneficios_rateio_extras WHERE competencia = ?",
    args: [competencia],
  });
  const linhas = resultado.rows as unknown as LinhaOverride[];
  return new Map(
    linhas.map((l) => [
      l.colaborador_id,
      { valeTransporte: l.vale_transporte, valeAlimentacao: l.vale_alimentacao, variaveis: l.variaveis },
    ]),
  );
}
