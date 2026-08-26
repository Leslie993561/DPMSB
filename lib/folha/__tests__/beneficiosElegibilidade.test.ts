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
