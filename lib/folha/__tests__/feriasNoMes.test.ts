import { describe, expect, it } from "vitest";
import { diasUteisDeFeriasNoMes, proporcionalAosDiasTrabalhados } from "../feriasNoMes";

describe("dias úteis de férias na competência", () => {
  it("conta só a parte das férias que cai no mês", () => {
    // Edilcelia: 31/08/2026 a 13/09/2026. Em agosto sobra só o dia 31,
    // que é uma segunda-feira.
    expect(diasUteisDeFeriasNoMes("2026-08", [{ inicio: "2026-08-31", fim: "2026-09-13" }])).toBe(1);
  });

  it("conta o restante no mês seguinte", () => {
    expect(diasUteisDeFeriasNoMes("2026-09", [{ inicio: "2026-08-31", fim: "2026-09-13" }])).toBe(9);
  });

  it("ignora sábado e domingo", () => {
    // 2026-08-01 é sábado; 02 é domingo. A janela de 01 a 07 tem 5 dias úteis.
    expect(diasUteisDeFeriasNoMes("2026-08", [{ inicio: "2026-08-01", fim: "2026-08-07" }])).toBe(5);
  });

  it("não conta o mesmo dia duas vezes quando as janelas se sobrepõem", () => {
    expect(
      diasUteisDeFeriasNoMes("2026-08", [
        { inicio: "2026-08-03", fim: "2026-08-07" },
        { inicio: "2026-08-05", fim: "2026-08-11" },
      ]),
    ).toBe(7);
  });

  it("é zero quando as férias não tocam o mês", () => {
    expect(diasUteisDeFeriasNoMes("2026-08", [{ inicio: "2026-10-01", fim: "2026-10-10" }])).toBe(0);
  });
});

describe("proporcional aos dias trabalhados", () => {
  it("abate um dia de 21 quando há um dia útil de férias", () => {
    // Edilcelia em agosto: 1 dia de férias em 21 dias úteis.
    expect(proporcionalAosDiasTrabalhados(210, 21, 1)).toBeCloseTo(200, 2);
  });

  it("abate cinco dias, como o DP pediu", () => {
    expect(proporcionalAosDiasTrabalhados(210, 21, 5)).toBeCloseTo(160, 2);
  });

  it("zera quando o mês inteiro é férias", () => {
    expect(proporcionalAosDiasTrabalhados(210, 21, 21)).toBe(0);
  });

  it("não fica negativo se as férias passarem dos dias úteis", () => {
    expect(proporcionalAosDiasTrabalhados(210, 21, 30)).toBe(0);
  });
});
