import { describe, expect, it } from "vitest";
import { parsearHoras, formatarHoras, horasImplausiveis } from "../horas";

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

/**
 * O caso real que fez uma planilha inteira entrar vazia: as células estavam
 * formatadas como HORA no Excel, e a leitura devolve uma data ancorada em
 * 30/12/1899. O valor precisa chegar aqui já como "HH:MM" — quem converte é
 * `normalizarCelula`, em lib/parsing/spreadsheet.ts.
 */
describe("parsearHoras · célula formatada como hora no Excel", () => {
  it('entende o "04:17" que a planilha do DP produz', () => {
    expect(parsearHoras("04:17")).toBeCloseTo(4 + 17 / 60, 6);
  });

  it("00:00 é zero hora, não ausência", () => {
    expect(parsearHoras("00:00")).toBe(0);
  });

  it("hora maior que a jornada de um dia continua valendo", () => {
    expect(parsearHoras("08:21")).toBeCloseTo(8 + 21 / 60, 6);
  });
});

describe("parsearHoras · sinal negativo", () => {
  it("aceita desconto já lançado com sinal", () => {
    expect(parsearHoras("-08:21")).toBeCloseTo(-(8 + 21 / 60), 6);
    expect(parsearHoras("-2,5")).toBeCloseTo(-2.5, 6);
  });

  it("formata negativo de volta com o sinal", () => {
    expect(formatarHoras(-(8 + 21 / 60))).toBe("-08:21");
  });

  it("aceita duração acima de 99 horas", () => {
    expect(parsearHoras("219:40")).toBeCloseTo(219 + 40 / 60, 6);
  });
});

describe("horasImplausiveis", () => {
  it("avisa sobre número que não cabe num mês de trabalho", () => {
    expect(horasImplausiveis(61)).toBe(true);
    expect(horasImplausiveis(219.66)).toBe(true);
    expect(horasImplausiveis(-500)).toBe(true);
  });

  it("não implica nas horas do dia a dia", () => {
    expect(horasImplausiveis(8.5)).toBe(false);
    expect(horasImplausiveis(18.3)).toBe(false);
    expect(horasImplausiveis(null)).toBe(false);
  });
});
