import { describe, expect, it } from "vitest";
import { estaNaFolha } from "@/lib/folha/vigencia";

/** Só os dois campos que a regra lê. */
function pessoa(dataAdmissao: string, dataDesligamento: string | null = null) {
  return { dataAdmissao, dataDesligamento };
}

describe("estaNaFolha", () => {
  it("entra na folha do mês da admissão, mesmo admitido no meio do mês", () => {
    expect(estaNaFolha(pessoa("2026-08-10"), "2026-08")).toBe(true);
  });

  it("não aparece nos meses anteriores à admissão", () => {
    expect(estaNaFolha(pessoa("2026-08-10"), "2026-07")).toBe(false);
    expect(estaNaFolha(pessoa("2026-08-10"), "2026-01")).toBe(false);
  });

  it("continua nos meses seguintes à admissão", () => {
    expect(estaNaFolha(pessoa("2026-08-10"), "2026-12")).toBe(true);
  });

  it("sai da folha já no mês do desligamento", () => {
    expect(estaNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-09")).toBe(false);
  });

  it("permanece nos meses anteriores ao desligamento", () => {
    expect(estaNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-08")).toBe(true);
  });

  it("não volta nos meses posteriores ao desligamento", () => {
    expect(estaNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-11")).toBe(false);
  });

  it("quem não tem data de admissão não entra — sem data não há como saber desde quando", () => {
    expect(estaNaFolha(pessoa(""), "2026-08")).toBe(false);
  });
});

describe("estaNaFolha · dados inconsistentes", () => {
  it("ignora desligamento anterior à admissão — é erro de digitação, não saída", () => {
    // Caso real do cadastro: admitida em 10/08/2026 com desligamento em 07/08/2026.
    expect(estaNaFolha({ dataAdmissao: "2026-08-10", dataDesligamento: "2026-08-07" }, "2026-08")).toBe(true);
  });

  it("continua respeitando desligamento no mesmo mês da admissão quando a data faz sentido", () => {
    expect(estaNaFolha({ dataAdmissao: "2026-08-01", dataDesligamento: "2026-08-20" }, "2026-08")).toBe(false);
  });
});
