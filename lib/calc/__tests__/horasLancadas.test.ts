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
