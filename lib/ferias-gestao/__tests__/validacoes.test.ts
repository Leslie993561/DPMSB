import { describe, expect, it } from "vitest";
import {
  avaliarRiscoDobro,
  calcularEstadoPeriodo,
  tetoAbono,
  validarLancamentoManual,
  validarNovoLancamentoCalculado,
  type PeriodoAquisitivoInfo,
} from "../validacoes";

const periodoNovo: PeriodoAquisitivoInfo = { diasDireito: 30, abonoUtilizado: false, diasAbono: 0 };

describe("calcularEstadoPeriodo", () => {
  it("soma apenas dias de gozo, ignorando abono", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 14 }, { dias: 5 }]);
    expect(estado.diasTirados).toBe(19);
    expect(estado.diasATirar).toBe(11);
    expect(estado.fracionamentos).toBe(2);
  });

  it("reduz diasDireitoEfetivo quando abono já foi utilizado", () => {
    const periodo: PeriodoAquisitivoInfo = { diasDireito: 30, abonoUtilizado: true, diasAbono: 10 };
    const estado = calcularEstadoPeriodo(periodo, [{ dias: 14 }]);
    expect(estado.diasDireitoEfetivo).toBe(20);
    expect(estado.diasATirar).toBe(6);
  });
});

describe("tetoAbono", () => {
  it("arredonda para baixo (30 dias -> 10)", () => {
    expect(tetoAbono(30)).toBe(10);
  });
  it("arredonda para baixo em valores não múltiplos de 3 (20 dias -> 6)", () => {
    expect(tetoAbono(20)).toBe(6);
  });
});

describe("validarNovoLancamentoCalculado", () => {
  it("rejeita o 1º período fracionado com menos de 14 dias", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 10, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/14 dias/);
  });

  it("aceita o 1º período fracionado com exatamente 14 dias", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 14, false);
    expect(r.ok).toBe(true);
  });

  it("rejeita o 2º período fracionado com menos de 5 dias", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 14 }]);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 4, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/5 dias/);
  });

  it("aceita o 2º período fracionado com exatamente 5 dias", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 14 }]);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 5, false);
    expect(r.ok).toBe(true);
  });

  it("rejeita o 4º período fracionado (limite de 3)", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 14 }, { dias: 5 }, { dias: 5 }]);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 5, false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Limite de 3/);
  });

  it("rejeita abono se já utilizado antes", () => {
    const periodo: PeriodoAquisitivoInfo = { diasDireito: 30, abonoUtilizado: true, diasAbono: 10 };
    const estado = calcularEstadoPeriodo(periodo, [{ dias: 14 }]);
    const r = validarNovoLancamentoCalculado(periodo, estado, 5, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já foi utilizado/);
  });

  it("aceita abono na primeira solicitação e ele conta no teto de dias", () => {
    // 30 dias de direito, abono (10) + 20 de gozo = exatamente o limite.
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 20, true);
    expect(r.ok).toBe(true);
  });

  it("rejeita quando gozo + abono ultrapassam os dias de direito na mesma solicitação", () => {
    // 21 de gozo + 10 de abono = 31 > 30.
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 21, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/excede os dias de direito/);
  });

  it("rejeita quando a soma com lançamentos anteriores ultrapassa os dias de direito", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 14 }]);
    const r = validarNovoLancamentoCalculado(periodoNovo, estado, 20, false); // 14+20=34>30
    expect(r.ok).toBe(false);
  });
});

describe("validarLancamentoManual", () => {
  it("não aplica mínimo de dias (aceita 3 dias, algo que o modal calculado rejeitaria)", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarLancamentoManual(periodoNovo, estado, 3, false, 0);
    expect(r.ok).toBe(true);
  });

  it("não aplica limite de 3 fracionamentos", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 5 }, { dias: 5 }, { dias: 5 }]);
    const r = validarLancamentoManual(periodoNovo, estado, 5, false, 0);
    expect(r.ok).toBe(true);
  });

  it("rejeita dias vendidos acima do teto", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, []);
    const r = validarLancamentoManual(periodoNovo, estado, 10, true, 11);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/não pode exceder 10/);
  });

  it("rejeita abono se já utilizado antes", () => {
    const periodo: PeriodoAquisitivoInfo = { diasDireito: 30, abonoUtilizado: true, diasAbono: 10 };
    const estado = calcularEstadoPeriodo(periodo, [{ dias: 14 }]);
    const r = validarLancamentoManual(periodo, estado, 5, true, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/já foi utilizado/);
  });

  it("rejeita quando ultrapassa o teto de dias de direito", () => {
    const estado = calcularEstadoPeriodo(periodoNovo, [{ dias: 20 }]);
    const r = validarLancamentoManual(periodoNovo, estado, 15, false, 0); // 20+15=35>30
    expect(r.ok).toBe(false);
  });
});

describe("avaliarRiscoDobro", () => {
  const limite = new Date("2026-01-10");

  it("não é risco se nada programado e ainda dentro do prazo", () => {
    expect(avaliarRiscoDobro(limite, null, new Date("2025-06-01"))).toBe(false);
  });

  it("é risco se nada programado e o prazo já passou", () => {
    expect(avaliarRiscoDobro(limite, null, new Date("2026-02-01"))).toBe(true);
  });

  it("é risco se a data de início programada é depois do limite", () => {
    expect(avaliarRiscoDobro(limite, new Date("2026-02-01"), new Date("2025-06-01"))).toBe(true);
  });

  it("não é risco se a data de início programada é antes do limite, mesmo que hoje já tenha passado o limite", () => {
    expect(avaliarRiscoDobro(limite, new Date("2026-01-05"), new Date("2026-03-01"))).toBe(false);
  });
});
