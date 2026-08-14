import { describe, expect, it } from "vitest";
import { calcularAvisoPrevio } from "../avisoPrevio";

describe("calcularAvisoPrevio (Lei 12.506/2011)", () => {
  it("retorna 30 dias para menos de 1 ano completo", () => {
    expect(calcularAvisoPrevio(6).dias).toBe(30);
  });

  it("soma 3 dias por ano completo de serviço", () => {
    expect(calcularAvisoPrevio(24).dias).toBe(36); // 30 + 3*2
  });

  it("respeita o teto de 90 dias", () => {
    expect(calcularAvisoPrevio(300).dias).toBe(90); // 30 + 3*20 = 90 (limitado)
  });

  it("não retorna valores negativos para tempo de serviço negativo", () => {
    expect(calcularAvisoPrevio(-5).dias).toBe(30);
  });
});
