import { describe, expect, it } from "vitest";
import { calcularSalarioFamilia } from "../salarioFamilia";

const COMPETENCIA = new Date("2026-08-01");

describe("calcularSalarioFamilia", () => {
  it("paga uma cota por filho menor de 14 anos", () => {
    const r = calcularSalarioFamilia(1500, [{ dataNascimento: "2015-03-10" }, { dataNascimento: "2020-01-05" }], COMPETENCIA);
    expect(r.filhosComCota).toBe(2);
    expect(r.valor).toBeCloseTo(2 * r.cotaPorFilho, 2);
  });

  it("não paga por filho que já fez 14 anos", () => {
    // Faz 14 em 2026-03-10, antes da competência de agosto.
    const r = calcularSalarioFamilia(1500, [{ dataNascimento: "2012-03-10" }], COMPETENCIA);
    expect(r.filhosComCota).toBe(0);
    expect(r.valor).toBe(0);
  });

  it("não paga nada acima do teto de remuneração", () => {
    const r = calcularSalarioFamilia(5000, [{ dataNascimento: "2020-01-05" }], COMPETENCIA);
    expect(r.dentroDoTeto).toBe(false);
    expect(r.valor).toBe(0);
  });

  it("não presume idade de dependente sem data de nascimento", () => {
    const r = calcularSalarioFamilia(1500, [{ dataNascimento: null }, { dataNascimento: "2020-01-05" }], COMPETENCIA);
    expect(r.semDataNascimento).toBe(1);
    expect(r.filhosComCota).toBe(1);
  });
});
