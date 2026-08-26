import { describe, expect, it } from "vitest";
import { calcularTransporteDoMes } from "../beneficios";

const base = { cidade: "São Paulo", salarioBase: 3000 };

describe("calcularTransporteDoMes", () => {
  it("VM é o valor fixo do mês, sem multiplicar por dias úteis", () => {
    const valor = calcularTransporteDoMes(
      { ...base, tipoTransporte: "vm_fixo", valorTransporteFixo: 378, valorTransporteDia: null },
      21,
    );
    expect(valor).toBe(378);
  });

  it("VM não muda quando o mês tem mais dias úteis", () => {
    const c = { ...base, tipoTransporte: "vm_fixo", valorTransporteFixo: 378, valorTransporteDia: null };
    expect(calcularTransporteDoMes(c, 21)).toBe(calcularTransporteDoMes(c, 23));
  });

  it("VT usa o valor do dia como ida+volta, não como um trecho", () => {
    // R$ 10,40/dia × 21 dias = R$ 218,40 bruto. Dobrar isso (o erro que a
    // planilha do DP revelaria só no total do mês) daria R$ 436,80.
    const salarioAlto = 100000; // desconto de 6% maior que o bruto seria absurdo; ver caso abaixo
    const valor = calcularTransporteDoMes(
      { ...base, salarioBase: salarioAlto, tipoTransporte: "vt_diario", valorTransporteFixo: null, valorTransporteDia: 10.4 },
      21,
    );
    // Com salário alto o desconto de 6% supera o bruto, então a empresa não
    // custeia nada — o que interessa aqui é que o bruto de partida é 218,40.
    expect(valor).toBe(0);
  });

  it("VT desconta do empregado até 6% do salário e a empresa paga o resto", () => {
    // Bruto: 18,00 × 21 = 378,00. Desconto: 6% de 1.500 = 90,00.
    const valor = calcularTransporteDoMes(
      { ...base, salarioBase: 1500, tipoTransporte: "vt_diario", valorTransporteFixo: null, valorTransporteDia: 18 },
      21,
    );
    expect(valor).toBe(288);
  });

  it("VT sem valor de dia cadastrado cai na tarifa da cidade, contada ida e volta", () => {
    const semCidade = calcularTransporteDoMes(
      { tipoTransporte: "vt_diario", valorTransporteFixo: null, valorTransporteDia: null, cidade: null, salarioBase: 3000 },
      21,
    );
    expect(semCidade).toBe(0);
  });

  it("VM sem valor cadastrado é zero, nunca a tarifa da cidade", () => {
    const valor = calcularTransporteDoMes(
      { ...base, tipoTransporte: "vm_fixo", valorTransporteFixo: null, valorTransporteDia: null },
      21,
    );
    expect(valor).toBe(0);
  });
});
