import { describe, expect, it } from "vitest";
import { calcularAdicionais } from "../adicionais";
import { getLegalTable } from "../../legal-tables";

const COMPETENCIA = new Date("2026-08-01");
const MINIMO = getLegalTable(COMPETENCIA).salarioMinimo;

describe("calcularAdicionais", () => {
  it("calcula periculosidade sobre o SALÁRIO BASE", () => {
    const r = calcularAdicionais(
      { salarioBase: 3000, periculosidadePercentual: 30, insalubridadePercentual: null, adicionalFixo: null },
      COMPETENCIA,
    );
    expect(r.periculosidade).toBeCloseTo(900, 2);
  });

  it("calcula insalubridade sobre o SALÁRIO MÍNIMO, não sobre o salário da pessoa", () => {
    const r = calcularAdicionais(
      { salarioBase: 3000, periculosidadePercentual: null, insalubridadePercentual: 20, adicionalFixo: null },
      COMPETENCIA,
    );
    expect(r.insalubridade).toBeCloseTo(MINIMO * 0.2, 2);
    expect(r.insalubridade).not.toBeCloseTo(600, 2);
  });

  it("soma o adicional fixo sem aplicar percentual", () => {
    const r = calcularAdicionais(
      { salarioBase: 3000, periculosidadePercentual: null, insalubridadePercentual: null, adicionalFixo: 250 },
      COMPETENCIA,
    );
    expect(r.adicionalFixo).toBe(250);
    expect(r.total).toBe(250);
  });

  it("é zero quando o colaborador não tem adicional nenhum", () => {
    const r = calcularAdicionais(
      { salarioBase: 3000, periculosidadePercentual: null, insalubridadePercentual: null, adicionalFixo: null },
      COMPETENCIA,
    );
    expect(r.total).toBe(0);
  });
});
