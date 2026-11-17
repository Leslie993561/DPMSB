import { describe, expect, it } from "vitest";
import { calcularTurnoverAno, type ColaboradorTurnover } from "../turnover";

const c = (id: number, adm: string | null, desl: string | null, status = desl ? "desligado" : "ativo"): ColaboradorTurnover => ({
  id, nome: `Pessoa ${id}`, status, dataAdmissao: adm, dataDesligamento: desl,
});

describe("calcularTurnoverAno", () => {
  const base = [c(1, "2020-01-01", null), c(2, "2020-01-01", null), c(3, "2020-01-01", null), c(4, "2020-01-01", null)];

  it("calcula efetivo, admissões, desligamentos e turnover do mês", () => {
    const meses = calcularTurnoverAno([...base, c(5, "2026-02-10", null), c(6, "2019-01-01", "2026-02-20")], 2026, "2026-12-31");
    const fev = meses[1];
    expect(fev.efetivoInicial).toBe(5); // 1-4 + 6
    expect(fev.admissoes).toBe(1);
    expect(fev.desligamentos).toBe(1);
    expect(fev.efetivoFinal).toBe(5);
    expect(fev.turnoverPct).toBeCloseTo(((1 + 1) / 2 / 5) * 100, 6); // 20%
  });

  it("não conta admitido antes de 2026 como admissão de 2026 e usa o último dia do mês", () => {
    const meses = calcularTurnoverAno(base, 2026, "2026-12-31");
    expect(meses[0].admissoes).toBe(0);
    expect(meses[0].efetivoFinal).toBe(4);
    expect(meses[0].turnoverPct).toBe(0);
    expect(meses[1].dataFim).toBe("2026-02-28");
  });

  it("meses futuros ficam sem resultado e o mês atual para em hoje", () => {
    const meses = calcularTurnoverAno([...base, c(7, "2026-06-25", null)], 2026, "2026-06-15");
    expect(meses[5].parcial).toBe(true);
    expect(meses[5].dataFim).toBe("2026-06-15");
    expect(meses[5].admissoes).toBe(0);
    expect(meses[5].efetivoFinal).toBe(4);
    expect(meses[6].futuro).toBe(true);
    expect(meses[6].turnoverPct).toBeNull();
  });

  it("evita divisão por zero e não conta desligado como ativo", () => {
    const meses = calcularTurnoverAno([c(1, "2010-01-01", "2025-05-05")], 2026, "2026-12-31");
    expect(meses[0].efetivoFinal).toBe(0);
    expect(meses[0].turnoverPct).toBeNull();
  });

  it("respeita datas históricas: cadastro tardio entra no mês certo", () => {
    const meses = calcularTurnoverAno([...base, c(9, "2026-03-03", null)], 2026, "2026-12-31");
    expect(meses[1].efetivoFinal).toBe(4);
    expect(meses[2].efetivoFinal).toBe(5);
    expect(meses[2].admitidos[0].data).toBe("2026-03-03");
  });
});
