import { describe, expect, it } from "vitest";
import { parsearHoras, formatarHoras } from "../horas";

describe("parsearHoras", () => {
  it('lê "08:01" como oito horas e um minuto, não como 8,01', () => {
    const h = parsearHoras("08:01");
    expect(h).toBeCloseTo(8 + 1 / 60, 6);
    expect(h).not.toBeCloseTo(8.01, 4);
  });

  it("lê meia hora corretamente", () => {
    expect(parsearHoras("08:30")).toBeCloseTo(8.5, 6);
  });

  it('aceita "8h30" e "8h"', () => {
    expect(parsearHoras("8h30")).toBeCloseTo(8.5, 6);
    expect(parsearHoras("8h")).toBe(8);
  });

  it("aceita decimal com vírgula", () => {
    expect(parsearHoras("8,5")).toBeCloseTo(8.5, 6);
  });

  it("número puro já é hora decimal", () => {
    expect(parsearHoras(8.5)).toBe(8.5);
  });

  it("vazio é nulo — não vira zero", () => {
    expect(parsearHoras("")).toBeNull();
    expect(parsearHoras(null)).toBeNull();
  });

  it("recusa minutos inválidos em vez de aceitar um valor errado", () => {
    expect(parsearHoras("8:75")).toBeNull();
  });
});

describe("formatarHoras", () => {
  it("devolve a forma que o DP escreveu", () => {
    expect(formatarHoras(8 + 1 / 60)).toBe("08:01");
    expect(formatarHoras(8.5)).toBe("08:30");
    expect(formatarHoras(0)).toBe("00:00");
  });

  it("ida e volta não perde o minuto", () => {
    expect(formatarHoras(parsearHoras("07:45"))).toBe("07:45");
    expect(formatarHoras(parsearHoras("123:59"))).toBe("123:59");
  });

  it("sem horas mostra travessão", () => {
    expect(formatarHoras(null)).toBe("—");
  });
});
