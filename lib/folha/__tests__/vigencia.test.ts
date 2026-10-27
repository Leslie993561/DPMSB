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

import { periodoNaFolha, diasUteisTrabalhados } from "@/lib/folha/vigencia";

describe("periodoNaFolha", () => {
  it("mês de admissão conta só a partir da data de entrada", () => {
    const p = periodoNaFolha(pessoa("2026-08-10"), "2026-08")!;
    expect(p.inicio).toBe("2026-08-10");
    expect(p.fim).toBe("2026-08-31");
    expect(p.diasCorridos).toBe(22);
    expect(p.admitidoNoMes).toBe(true);
  });

  it("mês do desligamento conta até a data do TRCT, inclusive", () => {
    const p = periodoNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-09")!;
    expect(p.fim).toBe("2026-09-15");
    expect(p.diasCorridos).toBe(15);
    expect(p.desligadoNoMes).toBe(true);
  });

  it("depois do mês do desligamento e antes da admissão está fora", () => {
    expect(periodoNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-10")).toBeNull();
    expect(periodoNaFolha(pessoa("2026-08-10"), "2026-07")).toBeNull();
  });

  it("admitido e desligado no mesmo mês", () => {
    const p = periodoNaFolha(pessoa("2026-06-25", "2026-07-21"), "2026-06")!;
    expect(p.diasCorridos).toBe(6);
  });
});

describe("diasUteisTrabalhados", () => {
  it("mês cheio devolve os dias úteis do mês", () => {
    const p = periodoNaFolha(pessoa("2020-01-01"), "2026-09")!;
    expect(diasUteisTrabalhados(p, "2026-09", 21)).toEqual({ dias: 21, razao: 1 });
  });

  it("desligado em 15/09/2026 trabalhou 11 dos 22 dias úteis (escala 21)", () => {
    const p = periodoNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-09")!;
    const r = diasUteisTrabalhados(p, "2026-09", 21);
    expect(r.dias).toBe(11);
  });

  it("desconta dia sem expediente dentro do período", () => {
    const p = periodoNaFolha(pessoa("2020-01-01", "2026-09-15"), "2026-09")!;
    expect(diasUteisTrabalhados(p, "2026-09", 21, ["2026-09-07"]).dias).toBe(10);
  });
});
