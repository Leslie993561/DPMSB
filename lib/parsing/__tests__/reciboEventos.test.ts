import { describe, expect, it } from "vitest";
import {
  competenciaDeTexto,
  extrairHolerites,
  percentualPadrao,
  resumirProventos,
  type ItemTexto,
} from "../reciboEventos";

const t = (x: number, y: number, texto: string): ItemTexto => ({ x, y, texto });

/** Uma via de holerite, com as posições reais do Recibo de Pagamento da folha mensal. */
function via(topo: number, opcoes: { salario?: string; eventos: [string, string, string, string, string][] }): ItemTexto[] {
  const itens: ItemTexto[] = [
    t(443, topo, "Folha Mensal"),
    t(432, topo - 11, "Agosto de 2026"),
    t(51, topo - 22, "Nome do Funcionário"),
    t(377, topo - 22, "CBO"),
    t(23, topo - 33, "1"),
    t(51, topo - 33, "DRIELLY"),
    t(95, topo - 33, "VICTOR"),
    t(366, topo - 33, "252515"),
    t(6, topo - 62, "Código"),
    t(135, topo - 62, "Descrição"),
    t(291, topo - 62, "Referência"),
    t(370, topo - 62, "Vencimentos"),
    t(454, topo - 62, "Descontos"),
    t(370, topo - 262, "Total de Vencimentos"),
    t(35, topo - 315, "Salário Base"),
    t(26, topo - 325, opcoes.salario ?? "3.723,82"),
  ];
  opcoes.eventos.forEach(([cod, desc, ref, venc, descto], i) => {
    const y = topo - 74 - i * 11;
    itens.push(t(10, y, cod), t(38, y, desc));
    if (ref) itens.push(t(325, y, ref));
    if (venc) itens.push(t(395, y, venc));
    if (descto) itens.push(t(480, y - 1, descto));
  });
  return itens;
}

describe("competenciaDeTexto", () => {
  it("converte o mês por extenso", () => {
    expect(competenciaDeTexto("Agosto de 2026")).toBe("2026-08");
    expect(competenciaDeTexto("Março de 2026")).toBe("2026-03");
    expect(competenciaDeTexto("Folha Mensal")).toBeNull();
  });
});

describe("extrairHolerites", () => {
  it("lê código, nome (sem o CBO), mês, salário e cada linha de evento pela posição", () => {
    const [h] = extrairHolerites(
      via(831, {
        eventos: [
          ["8781", "DIAS NORMAIS", "30,00", "3.723,82", ""],
          ["150", "HORAS EXTRAS", "4,72", "119,84", ""],
          ["998", "I.N.S.S.", "9,12", "", "352,59"],
        ],
      }),
    );
    expect(h).toMatchObject({ codigo: "1", nome: "DRIELLY VICTOR", competencia: "2026-08", salarioBase: 3723.82 });
    expect(h.eventos).toEqual([
      { codigo: "8781", descricao: "DIAS NORMAIS", referencia: 30, vencimento: 3723.82, desconto: null },
      { codigo: "150", descricao: "HORAS EXTRAS", referencia: 4.72, vencimento: 119.84, desconto: null },
      { codigo: "998", descricao: "I.N.S.S.", referencia: 9.12, vencimento: null, desconto: 352.59 },
    ]);
  });

  it("separa as duas vias da mesma página e marca a via em branco (asteriscos) sem salário", () => {
    const vias = extrairHolerites([
      ...via(831, { salario: "*********", eventos: [["8781", "DIAS NORMAIS", "", "", ""]] }),
      ...via(420, { eventos: [["150", "HORAS EXTRAS", "2,00", "50,00", ""]] }),
    ]);
    expect(vias.map((v) => v.salarioBase)).toEqual([null, 3723.82]);
    expect(vias[1].eventos).toHaveLength(1);
  });
});

describe("resumirProventos", () => {
  const ev = (descricao: string, referencia: number | null, vencimento: number | null) => ({
    codigo: "1",
    descricao,
    referencia,
    vencimento,
    desconto: null,
  });

  it("soma horas a 50% e a 100%, e ignora o reflexo no DSR e a média de férias", () => {
    const r = resumirProventos([
      ev("HORAS EXTRAS", 4, 100),
      ev("HORAS EXTRAS 50%", 2.5, 60),
      ev("HORAS EXTRAS 100%", 3, 120),
      ev("REFLEXO HORAS EXTRAS DSR", 0, 23.05),
      ev("MEDIA HORAS FERIAS", 0.75, 0.75),
    ]);
    expect(r.horasExtras50).toBe(6.5);
    expect(r.horasExtras100).toBe(3);
  });

  it("lê periculosidade e insalubridade como valores, e null quando o recibo não traz", () => {
    expect(resumirProventos([ev("ADICIONAL DE PERICULOSIDADE", 30, 1100)]).periculosidade).toBe(1100);
    expect(resumirProventos([ev("ADICIONAL INSALUBRIDADE", 20, 324.2)]).insalubridade).toBe(324.2);
    expect(resumirProventos([ev("DIAS NORMAIS", 30, 3000)])).toMatchObject({ periculosidade: null, insalubridade: null });
  });
});

describe("percentualPadrao", () => {
  it("aceita o percentual legal e recusa valor proporcional", () => {
    expect(percentualPadrao(1100, 3666.67, [30])).toBe(30);
    expect(percentualPadrao(324.24, 1621, [10, 20, 40])).toBe(20);
    expect(percentualPadrao(800, 3666.67, [30])).toBeNull();
  });
});
