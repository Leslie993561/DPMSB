import { describe, expect, it } from "vitest";
import {
  converterParaColaboradores,
  converterParaColaboradoresCadastro,
  sugerirMapeamento,
  sugerirMapeamentoColaborador,
} from "../mappers";

describe("sugerirMapeamento", () => {
  it("reconhece cabeçalhos com acento e maiúsculas", () => {
    const s = sugerirMapeamento(["Nome", "Salário Base", "Dependentes"]);
    const salario = s.find((x) => x.campo === "salarioBase");
    expect(salario?.coluna).toBe("Salário Base");
    expect(salario?.confianca).toBe(1);
  });

  it("reconhece sinônimos como 'Vencimento' para salário base", () => {
    const s = sugerirMapeamento(["Colaborador", "Vencimento"]);
    expect(s.find((x) => x.campo === "salarioBase")?.coluna).toBe("Vencimento");
  });

  it("retorna coluna nula quando nada é reconhecido", () => {
    const s = sugerirMapeamento(["Coluna A", "Coluna B"]);
    expect(s.find((x) => x.campo === "salarioBase")?.coluna).toBeNull();
  });

  it("marca salário base como obrigatório e os demais como opcionais", () => {
    const s = sugerirMapeamento(["Nome"]);
    expect(s.find((x) => x.campo === "salarioBase")?.obrigatorio).toBe(true);
    expect(s.find((x) => x.campo === "nome")?.obrigatorio).toBe(false);
  });
});

describe("converterParaColaboradores", () => {
  const mapeamento = { nome: "Nome", salarioBase: "Salario", dependentes: "Deps" };

  it("converte linhas válidas", () => {
    const r = converterParaColaboradores(
      [{ Nome: "Ana", Salario: 3000, Deps: 2 }],
      mapeamento,
    );
    expect(r.colaboradores).toHaveLength(1);
    expect(r.colaboradores[0]).toEqual({ nome: "Ana", salarioBase: 3000, dependentes: 2 });
    expect(r.descartadas).toHaveLength(0);
  });

  it("aceita salário como string com vírgula decimal", () => {
    const r = converterParaColaboradores([{ Nome: "Bruno", Salario: "2500,50", Deps: 0 }], mapeamento);
    expect(r.colaboradores[0].salarioBase).toBeCloseTo(2500.5, 2);
  });

  it("descarta linha com salário inválido e reporta o motivo em vez de silenciar", () => {
    const r = converterParaColaboradores(
      [
        { Nome: "Ana", Salario: 3000, Deps: 0 },
        { Nome: "Erro", Salario: "abc", Deps: 0 },
      ],
      mapeamento,
    );
    expect(r.colaboradores).toHaveLength(1);
    expect(r.descartadas).toHaveLength(1);
    expect(r.descartadas[0].linha).toBe(3);
  });

  it("lança erro se a coluna de salário não estiver mapeada", () => {
    expect(() => converterParaColaboradores([], { nome: "Nome" })).toThrow(/obrigatória/i);
  });

  it("assume 0 dependentes quando a coluna não é mapeada", () => {
    const r = converterParaColaboradores([{ Nome: "Ana", Salario: 3000 }], {
      nome: "Nome",
      salarioBase: "Salario",
    });
    expect(r.colaboradores[0].dependentes).toBe(0);
  });
});

describe("sugerirMapeamentoColaborador", () => {
  it("reconhece 'Admissão' como data de admissão", () => {
    const s = sugerirMapeamentoColaborador(["Nome", "Admissão", "Salário", "CPF"]);
    expect(s.find((x) => x.campo === "dataAdmissao")?.coluna).toBe("Admissão");
  });

  it("marca dataAdmissao e salarioBase como obrigatórios", () => {
    const s = sugerirMapeamentoColaborador(["Nome"]);
    expect(s.find((x) => x.campo === "dataAdmissao")?.obrigatorio).toBe(true);
    expect(s.find((x) => x.campo === "salarioBase")?.obrigatorio).toBe(true);
    expect(s.find((x) => x.campo === "cpf")?.obrigatorio).toBe(false);
  });
});

describe("converterParaColaboradoresCadastro", () => {
  const mapeamento = {
    nome: "Nome",
    dataAdmissao: "Admissão",
    salarioBase: "Salário",
    cpf: "CPF",
  };

  it("converte data no formato brasileiro (DD/MM/AAAA) para ISO", () => {
    const r = converterParaColaboradoresCadastro(
      [{ Nome: "Ana", Admissão: "15/09/2025", Salário: 1621, CPF: "123.456.789-00" }],
      mapeamento,
    );
    expect(r.colaboradores).toHaveLength(1);
    expect(r.colaboradores[0].dataAdmissao).toBe("2025-09-15");
    expect(r.colaboradores[0].cpf).toBe("123.456.789-00");
  });

  it("aceita data já em ISO", () => {
    const r = converterParaColaboradoresCadastro(
      [{ Nome: "Ana", Admissão: "2025-09-15", Salário: 1621 }],
      mapeamento,
    );
    expect(r.colaboradores[0].dataAdmissao).toBe("2025-09-15");
  });

  it("descarta linha com data de admissão inválida, sem silenciar", () => {
    const r = converterParaColaboradoresCadastro(
      [
        { Nome: "Ana", Admissão: "15/09/2025", Salário: 1621 },
        { Nome: "Erro", Admissão: "não é uma data", Salário: 1621 },
      ],
      mapeamento,
    );
    expect(r.colaboradores).toHaveLength(1);
    expect(r.descartadas).toHaveLength(1);
    expect(r.descartadas[0].motivo).toMatch(/Data de admissão inválida/);
  });

  it("descarta linha com salário inválido", () => {
    const r = converterParaColaboradoresCadastro(
      [{ Nome: "Ana", Admissão: "15/09/2025", Salário: "abc" }],
      mapeamento,
    );
    expect(r.colaboradores).toHaveLength(0);
    expect(r.descartadas).toHaveLength(1);
  });

  it("campos opcionais ausentes viram null, não string vazia ou erro", () => {
    const r = converterParaColaboradoresCadastro(
      [{ Nome: "Ana", Admissão: "15/09/2025", Salário: 1621 }],
      { nome: "Nome", dataAdmissao: "Admissão", salarioBase: "Salário" },
    );
    expect(r.colaboradores[0].cpf).toBeNull();
    expect(r.colaboradores[0].email).toBeNull();
  });

  it("lança erro se a coluna de data de admissão não estiver mapeada", () => {
    expect(() =>
      converterParaColaboradoresCadastro([], { nome: "Nome", salarioBase: "Salário" }),
    ).toThrow(/admissão/i);
  });
});
