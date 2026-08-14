export interface MemoriaCalculoStep {
  label: string;
  formula?: string;
  valor: number;
}

export interface CalculoResult<T = Record<string, never>> {
  valor: number;
  memoriaCalculo: MemoriaCalculoStep[];
  tabelaLegalVersao: string;
  detalhe: T;
}

/** Arredonda para 2 casas decimais evitando erros de ponto flutuante (ex.: 0.1 + 0.2). */
export function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
