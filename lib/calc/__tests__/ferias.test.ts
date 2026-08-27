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

  it("paga em dobro as férias concedidas fora do prazo (Art. 137 CLT)", () => {
    const base = {
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 30,
      abonoPecuniario: false,
      dependentes: 0,
      competencia: COMPETENCIA,
    };
    const noPrazo = calcularFerias(base);
    const emDobro = calcularFerias({ ...base, diasEmDobro: 30 });

    // A dobra é a remuneração das férias (gozo + 1/3) repetida uma vez.
    expect(noPrazo.detalhe.dobra).toBe(0);
    expect(emDobro.detalhe.dobra).toBeCloseTo(4000, 2);
    expect(emDobro.detalhe.valorLiquido - noPrazo.detalhe.valorLiquido).toBeCloseTo(4000, 2);
  });

  it("mantém a dobra fora da base de INSS/IRRF", () => {
    const base = {
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 30,
      abonoPecuniario: false,
      dependentes: 0,
      competencia: COMPETENCIA,
    };
    const noPrazo = calcularFerias(base);
    const emDobro = calcularFerias({ ...base, diasEmDobro: 30 });
    expect(emDobro.detalhe.inss).toBeCloseTo(noPrazo.detalhe.inss, 2);
    expect(emDobro.detalhe.irrf).toBeCloseTo(noPrazo.detalhe.irrf, 2);
  });

  it("não dobra o abono pecuniário, que é indenização de natureza distinta", () => {
    const emDobro = calcularFerias({
      salarioBase: 3000,
      diasDireito: 30,
      diasGozados: 20,
      abonoPecuniario: true,
      dependentes: 0,
      competencia: COMPETENCIA,
      diasEmDobro: 30,
    });
    const remuneracaoFerias = emDobro.detalhe.valorGozado + emDobro.detalhe.tercoConstitucional;
    expect(emDobro.detalhe.dobra).toBeCloseTo(remuneracaoFerias, 2);
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

  it("recua o limite p/ gozo conforme os dias a gozar, como o relatório do DP", () => {
    // Iago: aquisitivo 14/08/2024–13/08/2025, 20 dias de saldo. O relatório
    // imprime "Limite p/ gozo 25/07/2026" — 19 dias antes do fim do concessivo,
    // para que os 20 dias terminem dentro dele.
    const r = avaliarPrazoConcessao(new Date("2025-08-13"), new Date("2026-07-01"), 20);
    expect(r.limiteConcessao).toBe("2026-08-13");
    expect(r.limiteInicio).toBe("2026-07-25");
    expect(r.vencida).toBe(false);
  });

  it("dobra apenas os dias que vazam do período concessivo", () => {
    // 20 dias a partir de 01/08/2026: 13 caem dentro (até 13/08), 7 fora.
    const r = avaliarPrazoConcessao(new Date("2025-08-13"), new Date("2026-08-01"), 20);
    expect(r.vencida).toBe(true);
    expect(r.diasEmDobro).toBe(7);
  });

  it("dobra todos os dias quando as férias começam depois do fim do concessivo", () => {
    // O caso do Iago: 20 dias a partir de 17/08/2026, concessivo até 13/08/2026.
    const r = avaliarPrazoConcessao(new Date("2025-08-13"), new Date("2026-08-17"), 20);
    expect(r.diasEmDobro).toBe(20);
  });
});

describe("remuneração de férias com adicionais habituais (Art. 142 §5º)", () => {
  // Confere linha por linha contra o aviso de férias do Iago:
  // salário 3.243,75 + média de horas 49,44 + outras vantagens 973,13
  // = base 4.266,32 → 4.266,32 ÷ 30 = 142,21/dia → 20 dias = 2.844,21.
  const base = {
    salarioBase: 3243.75,
    diasDireito: 30,
    diasGozados: 20,
    abonoPecuniario: false,
    dependentes: 0,
    competencia: new Date("2025-08-17"),
  };

  it("soma médias e vantagens à base, como no aviso de férias", () => {
    const r = calcularFerias({ ...base, mediaHoras: 49.44, outrasVantagens: 973.13 });
    expect(r.detalhe.baseDeCalculo).toBeCloseTo(4266.32, 2);
    expect(r.detalhe.valorGozado).toBeCloseTo(2844.21, 1);
    expect(r.detalhe.tercoConstitucional).toBeCloseTo(948.07, 1);
  });

  it("sem adicionais a base continua sendo o salário, e o valor é menor", () => {
    const r = calcularFerias(base);
    expect(r.detalhe.baseDeCalculo).toBeCloseTo(3243.75, 2);
    expect(r.detalhe.valorGozado).toBeCloseTo(2162.5, 2);
  });

  it("a dobra do Art. 137 também segue a base cheia", () => {
    const r = calcularFerias({ ...base, mediaHoras: 49.44, outrasVantagens: 973.13, diasEmDobro: 20 });
    // Dobra = remuneração dos 20 dias + 1/3 = 2.844,21 + 948,07.
    expect(r.detalhe.dobra).toBeCloseTo(3792.28, 1);
  });
});
