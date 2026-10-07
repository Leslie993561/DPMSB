import { describe, it, expect } from "vitest";
import { interpretarFaturaExames } from "../faturaExames";

const TEXTO = [
  "Fechamento: 30/09/2026",
  "ASO Admissional \tAyla Farias Garcia Pires (855.750.545-00) em 22/09/2026",
  "R$ 49,80",
  "(0295) AVALIAÇÃO CLINICA OCUPACIONAL \tR$ 35,00",
  "(0673) GRUPO SANGUÍNEO / FATOR RH \tR$ 14,80",
  "ASO Periódico \tLUCAS PRATA OLIVEIRA (060.026.945-01) em 25/09/2026",
  "R$ 35,00\t(0295) AVALIAÇÃO CLINICA OCUPACIONAL \tR$ 35,00",
  "R$ 84,80\tTotal:",
].join("\n");

describe("interpretarFaturaExames", () => {
  it("lê asos, exames e total", () => {
    const f = interpretarFaturaExames(TEXTO);
    expect(f.fechamento).toBe("30/09/2026");
    expect(f.total).toBe(84.8);
    expect(f.asos).toHaveLength(2);
    expect(f.asos[0].exames.map((e) => e.codigo)).toEqual(["0295", "0673"]);
    expect(f.asos[1].valor).toBe(35);
    expect(f.asos[1].exames).toHaveLength(1);
  });
});
