import { describe, expect, it } from "vitest";
import { avaliarPrazoConcessao, calcularFerias } from "../ferias";

const COMPETENCIA = new Date("2025-06-01");

describe("calcularFerias", () => {
  it("calcula 30 dias de férias + 1/3 sem abono", () => {
    const r = calcularFerias({
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 30,
      abonoPecuniario: false,
      dependentes: 0,
      competencia: COMPETENCIA,
    });
    expect(r.detalhe.valorGozado).toBeCloseTo(3000, 2);
    expect(r.detalhe.tercoConstitucional).toBeCloseTo(1000, 2);
    expect(r.detalhe.abono).toBe(0);
  });

  it("calcula abono pecuniário como 1/3 dos dias de direito, com seu próprio 1/3", () => {
    const r = calcularFerias({
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 20,
      abonoPecuniario: true,
      dependentes: 0,
      competencia: COMPETENCIA,
    });
    expect(r.detalhe.diasVendidos).toBeCloseTo(10, 2);
    expect(r.detalhe.abono).toBeGreaterThan(0);
    expect(r.detalhe.tercoAbono).toBeCloseTo(r.detalhe.abono / 3, 2);
  });

  it("não tributa o abono pecuniário (apenas férias gozadas + 1/3 são base de INSS/IRRF)", () => {
    const comAbono = calcularFerias({
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 20,
      abonoPecuniario: true,
      dependentes: 0,
      competencia: COMPETENCIA,
    });
    const semAbono = calcularFerias({
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 20,
      abonoPecuniario: false,
      dependentes: 0,
      competencia: COMPETENCIA,
    });
    expect(comAbono.detalhe.inss).toBeCloseTo(semAbono.detalhe.inss, 2);
  });
});

describe("avaliarPrazoConcessao", () => {
  it("não considera vencida dentro dos 12 meses do período concessivo", () => {
    const r = avaliarPrazoConcessao(new Date("2024-06-01"), new Date("2025-05-01"));
    expect(r.vencida).toBe(false);
  });

  it("considera vencida após 12 meses do fim do período aquisitivo", () => {
    const r = avaliarPrazoConcessao(new Date("2024-01-01"), new Date("2025-03-01"));
    expect(r.vencida).toBe(true);
    expect(r.diasAtraso).toBeGreaterThan(0);
  });
});
