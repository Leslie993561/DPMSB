import { describe, expect, it } from "vitest";
import { converterExtrasImportadas } from "../folhaExtras";

const IDENTIFICACAO = ["Código", "Nome do colaborador"];

describe("converterExtrasImportadas · quais colunas vieram", () => {
  it("reconhece as quatro colunas de hora extra", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "Hora extra 50%", "Hora extra 100%", "Desconto de horas", "Hora noturna"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", "Hora extra 50%": 250.5, "Hora extra 100%": 400, "Desconto de horas": 80, "Hora noturna": 60 }],
    );
    expect(r.itens[0].horaExtra50).toBe(250.5);
    expect(r.itens[0].horaExtra100).toBe(400);
    expect(r.itens[0].descontoHoras).toBe(80);
    expect(r.itens[0].horaNoturna).toBe(60);
    expect(r.camposPresentes).toEqual(
      expect.arrayContaining(["horaExtra50", "horaExtra100", "descontoHoras", "horaNoturna"]),
    );
  });

  it("aceita o cabeçalho do modelo, que traz o grupo antes do nome", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "Hora extra · Hora extra 50%"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", "Hora extra · Hora extra 50%": 120 }],
    );
    expect(r.itens[0].horaExtra50).toBe(120);
  });

  it("avisa quais verbas conhecidas NÃO vieram no arquivo", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "VM"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", VM: 100 }],
    );
    expect(r.colunasNaoEncontradas).toContain("Hora extra 50%");
    expect(r.colunasNaoEncontradas).toContain("Odontológico");
    expect(r.colunasNaoEncontradas).not.toContain("VM");
    expect(r.camposPresentes).toEqual(["vm"]);
  });

  it("célula vazia vira null — quem grava decide preservar o valor anterior", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "VM"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", VM: "" }],
    );
    expect(r.itens[0].vm).toBeNull();
  });

  it("zero é valor, não vazio", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "VM"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", VM: 0 }],
    );
    expect(r.itens[0].vm).toBe(0);
  });

  it("não confunde as colunas calculadas com verba desconhecida", () => {
    const r = converterExtrasImportadas(
      [...IDENTIFICACAO, "Encargos · INSS", "Outros · Periculosidade", "Benefícios · Salário família"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", "Encargos · INSS": 100, "Outros · Periculosidade": 50, "Benefícios · Salário família": 65 }],
    );
    expect(r.colunasOutros).toEqual([]);
    expect(r.itens[0].outrosCustos).toBeNull();
  });
});

describe("converterExtrasImportadas · cabeçalhos abreviados", () => {
  it('entende "H.E. 50%" e "H.E. 100%", que o ponto transformava em coluna desconhecida', () => {
    const r = converterExtrasImportadas(
      ["Código", "Nome do colaborador", "H.E. 50%", "H.E. 100%"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", "H.E. 50%": 10, "H.E. 100%": 20 }],
    );
    expect(r.itens[0].horaExtra50).toBe(10);
    expect(r.itens[0].horaExtra100).toBe(20);
    expect(r.colunasOutros).toEqual([]);
  });

  it('entende "HE50" sem espaço', () => {
    const r = converterExtrasImportadas(
      ["Código", "Nome do colaborador", "HE50"],
      [{ "Código": "1", "Nome do colaborador": "Fulano", HE50: 15 }],
    );
    expect(r.itens[0].horaExtra50).toBe(15);
  });
});
