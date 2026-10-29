import { describe, expect, it } from "vitest";
import { alocarDiasPj, periodosAquisitivosCompletos, saldosPorPeriodo, saldoTotalPj, valorFeriasPj } from "../calc";

describe("períodos aquisitivos PJ", () => {
  it("antes de 12 meses completos não há período (saldo 0)", () => {
    const p = periodosAquisitivosCompletos("2026-01-15", "2026-10-29");
    expect(p).toEqual([]);
    expect(saldoTotalPj(p, 0)).toBe(0);
  });

  it("no aniversário fecha o primeiro período", () => {
    expect(periodosAquisitivosCompletos("2025-10-29", "2026-10-29")).toEqual([{ inicio: "2025-10-29", fim: "2026-10-28" }]);
    expect(periodosAquisitivosCompletos("2025-10-30", "2026-10-29")).toEqual([]);
  });

  it("2 anos de contrato sem gozo = saldo de 60 dias", () => {
    const p = periodosAquisitivosCompletos("2024-10-01", "2026-10-29");
    expect(p).toHaveLength(2);
    expect(saldoTotalPj(p, 0)).toBe(60);
  });
});

describe("abatimento pelo período mais antigo", () => {
  const periodos = periodosAquisitivosCompletos("2024-10-01", "2026-10-29");

  it("60 dias, tira 45: 1º quitado e 2º com 15", () => {
    const s = saldosPorPeriodo(periodos, 45);
    expect(s.map((x) => x.saldo)).toEqual([0, 15]);
    expect(saldoTotalPj(periodos, 45)).toBe(15);
  });

  it("aloca um pedido entre períodos, do mais antigo ao mais novo", () => {
    const s = saldosPorPeriodo(periodos, 20);
    expect(alocarDiasPj(s, 25)).toEqual([
      { indice: 0, dias: 10 },
      { indice: 1, dias: 15 },
    ]);
  });

  it("recusa mais dias que o saldo, e aceita qualquer fração que caiba", () => {
    const s = saldosPorPeriodo(periodos, 45);
    expect(alocarDiasPj(s, 16)).toBeNull();
    expect(alocarDiasPj(s, 15)).toEqual([{ indice: 1, dias: 15 }]);
    expect(alocarDiasPj(s, 1)).toEqual([{ indice: 1, dias: 1 }]);
  });
});

describe("valor das férias PJ", () => {
  it("mensal 3.000 e 10 dias = 1.000,00 (mês de 30 dias)", () => {
    expect(valorFeriasPj(3000, 10)).toBe(1000);
  });
});
