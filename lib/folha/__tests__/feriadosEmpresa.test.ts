import { describe, expect, it } from "vitest";
import { diasUteisFeriadosNoMes } from "../feriadosEmpresa";

describe("dias úteis de feriados da empresa na competência", () => {
  it("conta uma data marcada que é dia útil e cai no mês", () => {
    // 2026-09-07 é segunda-feira.
    expect(diasUteisFeriadosNoMes("2026-09", ["2026-09-07"])).toBe(1);
  });

  it("ignora data marcada num fim de semana", () => {
    // 2026-09-05 é sábado.
    expect(diasUteisFeriadosNoMes("2026-09", ["2026-09-05"])).toBe(0);
  });

  it("ignora data marcada em outro mês", () => {
    expect(diasUteisFeriadosNoMes("2026-09", ["2026-10-01"])).toBe(0);
  });

  it("soma mais de uma data útil no mesmo mês", () => {
    // 2026-09-07 (seg) e 2026-09-08 (ter).
    expect(diasUteisFeriadosNoMes("2026-09", ["2026-09-07", "2026-09-08", "2026-09-05"])).toBe(2);
  });

  it("é zero sem nenhuma data marcada", () => {
    expect(diasUteisFeriadosNoMes("2026-09", [])).toBe(0);
  });
});
