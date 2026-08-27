import { describe, expect, it } from "vitest";
import { detalharTransporteDoMes } from "../beneficios";

/**
 * Sem valor no Quadro de Colaboradores, o VT é zero.
 *
 * O portal recorria à tarifa média da cidade, e isso arbitrava folha: a
 * Tainara, de Lauro de Freitas e com o campo vazio, aparecia no rateio com
 * valor cheio, e nada na linha dizia que o número não vinha do cadastro dela.
 */
describe("vale-transporte sem valor cadastrado", () => {
  const base = {
    tipoTransporte: "vt_diario",
    valorTransporteFixo: null,
    salarioBase: 2000,
  };

  it("é zero quando o campo está vazio, mesmo com cidade conhecida", () => {
    const r = detalharTransporteDoMes({ ...base, valorTransporteDia: null, cidade: "LAURO DE FREITAS" }, 20);
    expect(r.bruto).toBe(0);
    expect(r.origem).toBe("sem-valor");
  });

  it("é zero quando o campo foi preenchido com zero", () => {
    const r = detalharTransporteDoMes({ ...base, valorTransporteDia: 0, cidade: "SALVADOR" }, 20);
    expect(r.bruto).toBe(0);
    expect(r.origem).toBe("sem-valor");
  });

  it("usa o valor do cadastro quando ele existe: 10,40 × 20 dias", () => {
    const r = detalharTransporteDoMes({ ...base, valorTransporteDia: 10.4, cidade: "LAURO DE FREITAS" }, 20);
    expect(r.bruto).toBeCloseTo(208, 2);
    expect(r.origem).toBe("cadastro");
  });

  it("vale-mobilidade continua sendo o fixo do mês", () => {
    const r = detalharTransporteDoMes(
      { tipoTransporte: "vm_fixo", valorTransporteFixo: 378, valorTransporteDia: null, cidade: null, salarioBase: 2000 },
      20,
    );
    expect(r.bruto).toBe(378);
    expect(r.origem).toBe("vm-fixo");
  });
});

describe("vale-mobilidade por dia útil", () => {
  const iago = {
    tipoTransporte: "vm_fixo",
    valorTransporteFixo: null,
    valorTransporteDia: 18,
    cidade: "CAMACARI",
    salarioBase: 3243.75,
  };

  it("multiplica pelos dias úteis do mês: 18 × 21 em setembro", () => {
    expect(detalharTransporteDoMes(iago, 21).bruto).toBeCloseTo(378, 2);
  });

  it("o valor por dia tem prioridade sobre o fixo mensal", () => {
    expect(detalharTransporteDoMes({ ...iago, valorTransporteFixo: 108 }, 21).bruto).toBeCloseTo(378, 2);
  });

  it("sem valor por dia, vale o fixo mensal", () => {
    expect(
      detalharTransporteDoMes({ ...iago, valorTransporteDia: null, valorTransporteFixo: 108 }, 21).bruto,
    ).toBeCloseTo(108, 2);
  });

  it("não sofre o desconto de 6% do vale-transporte", () => {
    expect(detalharTransporteDoMes(iago, 21).descontoEmpregado).toBe(0);
  });
});
