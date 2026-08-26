import { describe, expect, it } from "vitest";
import { acharParecido, distanciaEdicao } from "../parecidos";

const SETORES = ["Manutenção", "Produção", "Operações de Vendas", "Recursos Humanos", "Logística"];

describe("distanciaEdicao", () => {
  it("conta uma letra faltando", () => {
    expect(distanciaEdicao("mantencao", "manutencao")).toBe(1);
  });

  it("para de contar acima do teto em vez de percorrer tudo", () => {
    expect(distanciaEdicao("abc", "xyzwvu", 2)).toBe(3);
  });
});

describe("acharParecido", () => {
  it('pega o caso real: "mantenção" quase igual a "Manutenção"', () => {
    expect(acharParecido("mantenção", SETORES)).toBe("Manutenção");
  });

  it("ignora diferença só de acento e caixa — isso é o mesmo valor, não parecido", () => {
    expect(acharParecido("MANUTENCAO", SETORES)).toBeNull();
  });

  it('não aproxima "Vendas" de "Operações de Vendas" — podem ser setores diferentes', () => {
    expect(acharParecido("Vendas", SETORES)).toBeNull();
  });

  it("não opina sobre sigla curta", () => {
    expect(acharParecido("RH", SETORES)).toBeNull();
  });

  it("valor realmente novo não gera aviso", () => {
    expect(acharParecido("Jurídico", SETORES)).toBeNull();
  });
});
