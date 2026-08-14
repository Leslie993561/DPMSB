import { describe, expect, it } from "vitest";
import { calcularIRRF } from "../irrf";

const COMPETENCIA = new Date("2025-06-01");

describe("calcularIRRF", () => {
  it("isenta rendimento dentro da faixa isenta", () => {
    const r = calcularIRRF(2000, 0, COMPETENCIA);
    expect(r.valor).toBe(0);
  });

  it("aplica dedução por dependente reduzindo o imposto devido", () => {
    const semDependente = calcularIRRF(4000, 0, COMPETENCIA);
    const comDependentes = calcularIRRF(4000, 2, COMPETENCIA);
    expect(comDependentes.valor).toBeLessThan(semDependente.valor);
  });

  it("nunca retorna valor negativo mesmo com muitas deduções", () => {
    const r = calcularIRRF(2000, 10, COMPETENCIA);
    expect(r.valor).toBe(0);
  });

  it("considera pensão alimentícia como dedução adicional da base", () => {
    const semPensao = calcularIRRF(5000, 0, COMPETENCIA);
    const comPensao = calcularIRRF(5000, 0, COMPETENCIA, 1000);
    expect(comPensao.valor).toBeLessThan(semPensao.valor);
  });
});
