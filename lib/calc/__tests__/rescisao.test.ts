import { describe, expect, it } from "vitest";
import { calcularRescisao } from "../rescisao";

const baseInput = {
  salarioBase: 3000,
  dataAdmissao: new Date("2023-01-10"),
  dataDesligamento: new Date("2025-06-15"),
  diasTrabalhadosNoMes: 15,
  feriasVencidasDias: 0,
  mesesTrabalhadosNoAnoParaDecimoTerceiro: 6,
  dependentes: 0,
};

describe("calcularRescisao", () => {
  it("inclui multa de 40% do FGTS em dispensa sem justa causa", () => {
    const r = calcularRescisao({
      ...baseInput,
      tipo: "sem_justa_causa",
      avisoPrevioIndenizado: true,
      saldoFgtsDepositado: 5000,
    });
    expect(r.detalhe.multaFgts).toBeCloseTo(2000, 2); // 40% de 5000
  });

  it("não inclui multa de FGTS nem aviso prévio em pedido de demissão", () => {
    const r = calcularRescisao({
      ...baseInput,
      tipo: "pedido_demissao",
      avisoPrevioIndenizado: false,
      saldoFgtsDepositado: 5000,
    });
    expect(r.detalhe.multaFgts).toBe(0);
    expect(r.detalhe.avisoPrevioValor).toBe(0);
  });

  it("aplica metade da multa de FGTS e do aviso prévio no acordo Art. 484-A CLT", () => {
    const r = calcularRescisao({
      ...baseInput,
      tipo: "acordo_484a",
      avisoPrevioIndenizado: true,
      saldoFgtsDepositado: 5000,
    });
    expect(r.detalhe.multaFgts).toBeCloseTo(1000, 2); // 20% de 5000
  });

  it("exclui 13º e férias proporcionais em justa causa, mas mantém férias vencidas", () => {
    const r = calcularRescisao({
      ...baseInput,
      tipo: "justa_causa",
      avisoPrevioIndenizado: false,
      feriasVencidasDias: 30,
      saldoFgtsDepositado: 5000,
    });
    expect(r.detalhe.decimoTerceiroProporcional).toBe(0);
    expect(r.detalhe.feriasProporcionais).toBe(0);
    expect(r.detalhe.feriasVencidas).toBeGreaterThan(0);
  });

  it("sinaliza estimativa quando o saldo de FGTS não é informado", () => {
    const r = calcularRescisao({
      ...baseInput,
      tipo: "sem_justa_causa",
      avisoPrevioIndenizado: true,
    });
    expect(r.detalhe.fgtsEstimado).toBe(true);
    expect(r.detalhe.observacoes.some((o) => o.includes("ESTIMADA"))).toBe(true);
  });
});
