import { describe, expect, it } from "vitest";
import { estaNaFolha } from "@/lib/folha/vigencia";

/**
 * O rateio de benefícios só considera quem está na folha CLT do mês. Estes
 * casos travam a regra que faltava: desligado e PJ não entram na conta, e por
 * isso também não aparecem cobrando cadastro de vale-transporte.
 */
describe("elegibilidade a benefícios", () => {
  const base = { dataAdmissao: "2025-03-10", dataDesligamento: null as string | null };

  it("não inclui quem foi desligado antes da competência", () => {
    expect(estaNaFolha({ ...base, dataDesligamento: "2026-05-20" }, "2026-08")).toBe(false);
  });

  it("não inclui quem ainda não tinha sido admitido", () => {
    expect(estaNaFolha({ dataAdmissao: "2026-09-01", dataDesligamento: null }, "2026-08")).toBe(false);
  });

  it("inclui quem estava na empresa o mês inteiro", () => {
    expect(estaNaFolha(base, "2026-08")).toBe(true);
  });

  it("ignora desligamento anterior à admissão, que só pode ser erro de digitação", () => {
    expect(estaNaFolha({ dataAdmissao: "2025-02-03", dataDesligamento: "2001-02-09" }, "2026-08")).toBe(true);
  });
});

describe("desligado com data de desligamento inutilizável", () => {
  // O cadastro da Nathalia tem admissão 03/02/2025 e desligamento 09/02/2001 —
  // ano digitado errado. A data é ignorada, mas o status diz "desligado", e
  // isso basta para tirá-la da folha corrente.
  const nathalia = {
    dataAdmissao: "2025-02-03",
    dataDesligamento: "2001-02-09",
    status: "desligado",
  };

  it("sai da competência corrente", () => {
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    expect(estaNaFolha(nathalia, mesAtual)).toBe(false);
  });

  it("continua nas competências passadas, que não se reescrevem por um chute", () => {
    expect(estaNaFolha(nathalia, "2025-06")).toBe(true);
  });

  it("quem está ativo com data impossível permanece na folha", () => {
    expect(
      estaNaFolha({ dataAdmissao: "2026-08-10", dataDesligamento: "2026-08-07", status: "ativo" }, "2026-08"),
    ).toBe(true);
  });
});
