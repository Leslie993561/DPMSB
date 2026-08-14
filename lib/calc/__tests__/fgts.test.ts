import { describe, expect, it } from "vitest";
import { calcularFGTS } from "../fgts";

describe("calcularFGTS", () => {
  it("aplica 8% sobre o salário base", () => {
    const r = calcularFGTS(3000, new Date("2025-06-01"));
    expect(r.valor).toBeCloseTo(240, 2);
  });
});
