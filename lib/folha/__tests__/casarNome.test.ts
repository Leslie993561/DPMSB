import { describe, expect, it } from "vitest";
import { casarPorNome, normalizarNome, nomeReduzido } from "../casarNome";

const CADASTRO = [
  { nome: " Elivã Da Natividade Meneses" },
  { nome: "Patricio Fe de Oliveira" },
  { nome: "Ana Maria Alves Santos" },
];

const buscar = (n: string) => casarPorNome(n, CADASTRO, (c) => c.nome);

describe("normalizarNome", () => {
  it("tira acento, pontuação e espaço sobrando", () => {
    expect(normalizarNome(" PATRÍCIO FÉ DE OLIVEIRA ")).toBe("patricio fe de oliveira");
  });
});

describe("nomeReduzido", () => {
  it("descarta conectivos", () => {
    expect(nomeReduzido("Elivã Da Natividade Meneses")).toBe("eliva natividade meneses");
  });
});

describe("casarPorNome", () => {
  it("acha mesmo com acento diferente — o caso do Patrício", () => {
    expect(buscar("PATRÍCIO FÉ DE OLIVEIRA").encontrado?.nome).toBe("Patricio Fe de Oliveira");
  });

  it('acha com o conectivo "Da" faltando — o caso da Elivã', () => {
    expect(buscar("ELIVÃ NATIVIDADE MENESES").encontrado?.nome).toBe(" Elivã Da Natividade Meneses");
  });

  it("ignora espaço sobrando no cadastro", () => {
    expect(buscar("Elivã Da Natividade Meneses").encontrado?.nome).toBe(" Elivã Da Natividade Meneses");
  });

  it("não acha quem não existe", () => {
    const r = buscar("Fulano de Tal");
    expect(r.encontrado).toBeNull();
    expect(r.ambiguo).toBe(false);
  });

  it("com dois candidatos iguais não escolhe nenhum — recusar é melhor que errar", () => {
    const duplicado = [{ nome: "Ana Maria Alves Santos" }, { nome: "Ana Maria Alves Santos" }];
    const r = casarPorNome("ANA MARIA ALVES SANTOS", duplicado, (c) => c.nome);
    expect(r.encontrado).toBeNull();
    expect(r.ambiguo).toBe(true);
  });

  it("nome vazio não casa com ninguém", () => {
    expect(buscar("   ").encontrado).toBeNull();
  });
});
