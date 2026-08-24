import { describe, expect, it } from "vitest";
import { detectarConflitos } from "../conflitos";
import type { LancamentoComContexto } from "@/lib/db/lancamentosFerias";
import type { StatusLancamento } from "@/lib/db/lancamentosFerias";

const HOJE = new Date("2026-08-24");

/** Só os campos que `detectarConflitos` lê — o resto do lançamento é irrelevante aqui. */
function lancamento(
  nome: string,
  departamento: string | null,
  inicio: string,
  dias: number,
  status: StatusLancamento = "programada",
): LancamentoComContexto {
  return {
    lancamento: {
      status,
      dias,
      dataInicioPrevista: inicio,
      dataInicioGozo: null,
    },
    colaboradorNome: nome,
    colaboradorDepartamento: departamento,
  } as unknown as LancamentoComContexto;
}

describe("detectarConflitos", () => {
  it("acusa duas pessoas do mesmo setor saindo juntas", () => {
    const r = detectarConflitos(
      [lancamento("Ana", "Produção", "2026-09-01", 10), lancamento("Bia", "Produção", "2026-09-01", 10)],
      HOJE,
    );
    expect(r).toHaveLength(1);
  });

  it("acusa férias que começam durante as férias de outra pessoa do setor", () => {
    const r = detectarConflitos(
      [lancamento("Ana", "Produção", "2026-09-01", 15), lancamento("Bia", "Produção", "2026-09-10", 10)],
      HOJE,
    );
    expect(r).toHaveLength(1);
  });

  it("não acusa quando as férias não se tocam", () => {
    const r = detectarConflitos(
      [lancamento("Ana", "Produção", "2026-09-01", 10), lancamento("Bia", "Produção", "2026-09-15", 10)],
      HOJE,
    );
    expect(r).toHaveLength(0);
  });

  it("não acusa pessoas de setores diferentes", () => {
    const r = detectarConflitos(
      [lancamento("Ana", "Produção", "2026-09-01", 10), lancamento("Bia", "Financeiro", "2026-09-01", 10)],
      HOJE,
    );
    expect(r).toHaveLength(0);
  });

  it("ignora férias que já terminaram — histórico não é conflito", () => {
    const r = detectarConflitos(
      [
        lancamento("Ana", "Produção", "2025-03-01", 10, "concluida"),
        lancamento("Bia", "Produção", "2025-03-01", 10, "concluida"),
      ],
      HOJE,
    );
    expect(r).toHaveLength(0);
  });

  it("acusa programação que cai dentro de férias em andamento", () => {
    const r = detectarConflitos(
      [
        lancamento("Ana", "Produção", "2026-08-20", 15, "concluida"),
        lancamento("Bia", "Produção", "2026-08-28", 10),
      ],
      HOJE,
    );
    expect(r).toHaveLength(1);
  });

  it("não acusa lançamento cancelado", () => {
    const r = detectarConflitos(
      [
        lancamento("Ana", "Produção", "2026-09-01", 10),
        lancamento("Bia", "Produção", "2026-09-01", 10, "cancelada"),
      ],
      HOJE,
    );
    expect(r).toHaveLength(0);
  });
});
