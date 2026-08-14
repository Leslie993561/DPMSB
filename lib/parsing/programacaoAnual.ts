import type { LinhaPlanilha } from "./spreadsheet";
import type { LinhaProgramacaoAnual } from "../db/importarProgramacaoAnual";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type CampoAnual = keyof LinhaProgramacaoAnual;

const SINONIMOS: Record<CampoAnual, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeColaborador: ["nome do colaborador", "colaborador", "nome", "empregado", "funcionario"],
  aquisitivoInicio: ["aquisitivo inicio", "inicio aquisitivo", "aquisitivo"],
  aquisitivoFim: ["aquisitivo fim", "fim aquisitivo"],
  inicioFerias: ["inicio das ferias", "inicio ferias", "data de inicio"],
  diasFerias: ["dias de ferias", "dias ferias", "dias"],
  abono: ["abono sim nao", "abono"],
  diasAbono: ["dias de abono", "dias abono"],
  observacoes: ["observacoes", "observacao", "obs"],
};

function mapearCabecalhos(cabecalhos: string[]): Partial<Record<CampoAnual, string>> {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  const mapa: Partial<Record<CampoAnual, string>> = {};
  (Object.keys(SINONIMOS) as CampoAnual[]).forEach((campo) => {
    const encontrado = normalizados.find((c) => SINONIMOS[campo].some((s) => c.norm === s || c.norm.includes(s)));
    if (encontrado) mapa[campo] = encontrado.original;
  });
  return mapa;
}

function paraIso(valor: string | number | null): string | null {
  if (valor === null || valor === "") return null;
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const br = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) {
    const [, dia, mes, ano] = br;
    const d = Number(dia);
    const m = Number(mes);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return `${ano}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
  }
  return null;
}

function paraNumero(valor: string | number | null): number {
  if (valor === null || valor === "") return 0;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function paraBooleano(valor: string | number | null): boolean {
  if (valor === null) return false;
  const t = normalizar(String(valor));
  return t === "sim" || t === "s" || t === "true" || t === "1" || t === "x";
}

export interface ConversaoProgramacaoAnual {
  itens: LinhaProgramacaoAnual[];
  descartadas: { linha: number; motivo: string }[];
}

/** Colunas de contexto (centro de custo, cargo, gestor, salário, admissão, concessivo, trimestre) são só informativas — não afetam o lançamento. */
export function converterProgramacaoAnual(cabecalhos: string[], linhas: LinhaPlanilha[]): ConversaoProgramacaoAnual {
  const mapa = mapearCabecalhos(cabecalhos);
  if (!mapa.nomeColaborador) {
    throw new Error('Não foi possível identificar a coluna do colaborador (ex.: "Nome do colaborador").');
  }
  if (!mapa.aquisitivoInicio || !mapa.aquisitivoFim || !mapa.inicioFerias) {
    throw new Error("Não foi possível identificar as colunas de aquisitivo início/fim e início das férias.");
  }

  const itens: LinhaProgramacaoAnual[] = [];
  const descartadas: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const nomeColaborador = String(linha[mapa.nomeColaborador!] ?? "").trim();
    if (!nomeColaborador) {
      descartadas.push({ linha: numeroLinha, motivo: "Nome do colaborador ausente." });
      return;
    }

    const aquisitivoInicio = paraIso(linha[mapa.aquisitivoInicio!]);
    const aquisitivoFim = paraIso(linha[mapa.aquisitivoFim!]);
    const inicioFerias = paraIso(linha[mapa.inicioFerias!]);
    if (!aquisitivoInicio || !aquisitivoFim || !inicioFerias) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Datas inválidas para "${nomeColaborador}" (use DD/MM/AAAA).`,
      });
      return;
    }

    itens.push({
      codigo: mapa.codigo ? String(linha[mapa.codigo] ?? "").trim() || null : null,
      nomeColaborador,
      aquisitivoInicio,
      aquisitivoFim,
      inicioFerias,
      diasFerias: mapa.diasFerias ? paraNumero(linha[mapa.diasFerias]) : 0,
      abono: mapa.abono ? paraBooleano(linha[mapa.abono]) : false,
      diasAbono: mapa.diasAbono ? paraNumero(linha[mapa.diasAbono]) : 0,
      observacoes: mapa.observacoes ? String(linha[mapa.observacoes] ?? "").trim() || null : null,
    });
  });

  return { itens, descartadas };
}
