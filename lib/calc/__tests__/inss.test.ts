import { describe, expect, it } from "vitest";
import { calcularINSS } from "../inss";

const COMPETENCIA = new Date("2025-06-01");

describe("calcularINSS", () => {
  it("aplica apenas a primeira faixa para salário no valor do mínimo", () => {
    const r = calcularINSS(1518.0, COMPETENCIA);
    expect(r.valor).toBeCloseTo(1518.0 * 0.075, 2);
    expect(r.detalhe.faixasAplicadas).toHaveLength(1);
  });

  it("aplica alíquotas progressivas por faixa, não uma única alíquota sobre o total", () => {
    const r = calcularINSS(3000, COMPETENCIA);
    expect(r.detalhe.faixasAplicadas.length).toBeGreaterThan(1);
    // Não pode ser igual a uma alíquota flat de 12% sobre o total
    expect(r.valor).not.toBeCloseTo(3000 * 0.12, 2);
  });

  it("respeita o teto de contribuição do INSS", () => {
    const acimaDoTeto = calcularINSS(20000, COMPETENCIA);
    const noTeto = calcularINSS(8157.41, COMPETENCIA);
    expect(acimaDoTeto.valor).toBeCloseTo(noTeto.valor, 2);
  });

  it("retorna zero para salário zero", () => {
    expect(calcularINSS(0, COMPETENCIA).valor).toBe(0);
  });
});
