import { describe, expect, it } from "vitest";
import { calcularCustoMensalEmpregador } from "../custoEmpregador";

/**
 * Os dois demonstrativos do DP, conferidos linha por linha. São eles que
 * definem o modelo — se algum número mudar aqui, é porque o modelo mudou.
 */
describe("custo mensal do empregador", () => {
  const competencia = new Date("2026-08-01");

  describe("celetista — salário R$ 1.718,26, custo R$ 2.766,59", () => {
    const r = calcularCustoMensalEmpregador(1718.26, competencia, "celetista");

    it("compõe cada encargo como no demonstrativo", () => {
      expect(r.inssPatronal).toBeCloseTo(343.65, 2);
      expect(r.rat).toBeCloseTo(17.18, 2);
      expect(r.terceiros).toBeCloseTo(99.66, 2);
      expect(r.fgts).toBeCloseTo(137.46, 2);
      expect(r.provisaoDecimoTerceiro).toBeCloseTo(143.19, 2);
      expect(r.provisaoFerias).toBeCloseTo(143.19, 2);
      expect(r.provisaoTercoFerias).toBeCloseTo(47.73, 2);
    });

    it("agrupa em diretos 34,80%, provisões 19,44% e sobre provisões 6,77%", () => {
      expect(r.aliquotaEncargosDiretos).toBeCloseTo(0.348, 4);
      expect(r.aliquotaProvisoes).toBeCloseTo(0.1944, 4);
      expect(r.aliquotaEncargosSobreProvisoes).toBeCloseTo(0.0677, 4);
      expect(r.encargosDiretos).toBeCloseTo(597.95, 2);
      expect(r.provisoes).toBeCloseTo(334.11, 2);
      expect(r.encargosSobreProvisoes).toBeCloseTo(116.27, 2);
    });

    it("fecha o custo mensal", () => {
      expect(r.total).toBeCloseTo(2766.59, 1);
    });
  });

  describe("jovem aprendiz — salário R$ 810,50, custo R$ 1.246,91", () => {
    const r = calcularCustoMensalEmpregador(810.5, competencia, "aprendiz");

    it("usa FGTS de 2%, e só isso muda", () => {
      expect(r.fgts).toBeCloseTo(16.21, 2);
      expect(r.inssPatronal).toBeCloseTo(162.1, 2);
      expect(r.rat).toBeCloseTo(8.11, 2);
      expect(r.terceiros).toBeCloseTo(47.01, 2);
    });

    it("baixa os encargos diretos para 28,80% e os sobre provisões para 5,60%", () => {
      expect(r.aliquotaEncargosDiretos).toBeCloseTo(0.288, 4);
      expect(r.aliquotaProvisoes).toBeCloseTo(0.1944, 4);
      expect(r.aliquotaEncargosSobreProvisoes).toBeCloseTo(0.056, 4);
      expect(r.encargosDiretos).toBeCloseTo(233.42, 2);
      expect(r.provisoes).toBeCloseTo(157.6, 2);
      expect(r.encargosSobreProvisoes).toBeCloseTo(45.39, 2);
    });

    it("fecha o custo mensal", () => {
      expect(r.total).toBeCloseTo(1246.91, 1);
    });
  });
});
