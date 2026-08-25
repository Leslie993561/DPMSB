import { describe, expect, it } from "vitest";
import { calcularValorDasHoras } from "../horasLancadas";

const SALARIO = 2200; // hora normal = 10,00 com jornada de 220h
const NENHUMA = { extra50: null, extra100: null, desconto: null, noturna: null };

describe("calcularValorDasHoras", () => {
  it("hora extra de 50% vale uma vez e meia a hora normal", () => {
    const r = calcularValorDasHoras(SALARIO, { ...NENHUMA, extra50: 10 });
    expect(r.valorHoraNormal).toBeCloseTo(10, 2);
    expect(r.extra50).toBeCloseTo(150, 2);
  });

  it("hora extra de 100% vale o dobro", () => {
    const r = calcularValorDasHoras(SALARIO, { ...NENHUMA, extra100: 10 });
    expect(r.extra100).toBeCloseTo(200, 2);
  });

  it("hora noturna soma só o adicional de 20% — a hora já está no salário", () => {
    const r = calcularValorDasHoras(SALARIO, { ...NENHUMA, noturna: 10 });
    expect(r.noturna).toBeCloseTo(20, 2);
    expect(r.noturna).not.toBeCloseTo(120, 2);
  });

  it("desconto de horas sai pela hora normal, sem adicional", () => {
    const r = calcularValorDasHoras(SALARIO, { ...NENHUMA, desconto: 10 });
    expect(r.desconto).toBeCloseTo(100, 2);
    expect(r.liquido).toBeCloseTo(-100, 2);
  });

  it("o líquido soma os adicionais e subtrai o desconto", () => {
    const r = calcularValorDasHoras(SALARIO, { extra50: 10, extra100: 5, noturna: 10, desconto: 2 });
    expect(r.liquido).toBeCloseTo(150 + 100 + 20 - 20, 2);
  });

  it("respeita a fração do minuto: 08:01 rende mais que 08:00", () => {
    const oitoEmPonto = calcularValorDasHoras(SALARIO, { ...NENHUMA, extra50: 8 });
    const oitoEUm = calcularValorDasHoras(SALARIO, { ...NENHUMA, extra50: 8 + 1 / 60 });
    expect(oitoEUm.extra50).toBeGreaterThan(oitoEmPonto.extra50);
    expect(oitoEUm.extra50 - oitoEmPonto.extra50).toBeCloseTo(0.25, 2);
  });

  it("sem salário não inventa valor", () => {
    const r = calcularValorDasHoras(0, { ...NENHUMA, extra50: 10 });
    expect(r.extra50).toBe(0);
  });
});

/**
 * Os exemplos que o DP passou por escrito, ao pé da letra. Servem de âncora:
 * se alguém mexer no fator ou na jornada, é aqui que quebra primeiro.
 */
describe("calcularValorDasHoras · exemplos conferidos com o DP", () => {
  it("salário 2.200 dá hora de R$ 10,00 com jornada de 220h", () => {
    const r = calcularValorDasHoras(2200, NENHUMA);
    expect(r.valorHoraNormal).toBeCloseTo(10, 2);
  });

  it("2 horas extras a 50% = R$ 30,00 (10,00 + 5,00 = 15,00 por hora)", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 2 });
    expect(r.extra50).toBeCloseTo(30, 2);
  });

  it("2 horas extras a 100% = R$ 40,00 (10,00 × 2 = 20,00 por hora)", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra100: 2 });
    expect(r.extra100).toBeCloseTo(40, 2);
  });
});

describe("calcularValorDasHoras · DSR conferido com o DP", () => {
  const CALENDARIO = { diasUteis: 25, diasDsr: 5 };

  it("10 horas a 50% com salário 2.200 dão R$ 150,00 de hora extra", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10 }, 220, CALENDARIO);
    expect(r.extra50).toBeCloseTo(150, 2);
  });

  it("DSR = 150 ÷ 25 × 5 = R$ 30,00", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10 }, 220, CALENDARIO);
    expect(r.dsr).toBeCloseTo(30, 2);
  });

  it("total com DSR = R$ 180,00", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10 }, 220, CALENDARIO);
    expect(r.liquido).toBeCloseTo(180, 2);
  });

  it("sem calendário o DSR é zero — não se chuta 25/5", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10 });
    expect(r.dsr).toBe(0);
    expect(r.liquido).toBeCloseTo(150, 2);
  });

  it("o desconto de horas fica fora da base do DSR — não é adicional", () => {
    const so50 = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10 }, 220, CALENDARIO);
    const comDesconto = calcularValorDasHoras(2200, { ...NENHUMA, extra50: 10, desconto: 5 }, 220, CALENDARIO);
    expect(comDesconto.dsr).toBeCloseTo(so50.dsr, 2);
  });

  it("o adicional noturno também reflete no DSR", () => {
    const r = calcularValorDasHoras(2200, { ...NENHUMA, noturna: 10 }, 220, CALENDARIO);
    expect(r.noturna).toBeCloseTo(20, 2);
    expect(r.dsr).toBeCloseTo(4, 2);
  });
});
