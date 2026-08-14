import type { LinhaPlanilha } from "./spreadsheet";
import type { LinhaImportacaoFerias } from "../db/importarProgramacaoFerias";

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

const SINONIMOS: Record<keyof LinhaImportacaoFerias, string[]> = {
  codigo: ["codigo", "cod", "matricula", "id"],
  nomeEmpregado: ["empregado", "nome", "colaborador", "funcionario", "nome do colaborador"],
  aquisitivoInicio: ["inicio do periodo aquisitivo", "inicio aquisitivo", "aquisitivo inicio", "inicio do periodo"],
  aquisitivoFim: ["fim do periodo aquisitivo", "fim aquisitivo", "aquisitivo fim", "fim do periodo"],
  diasDireito: ["dias de direito", "dias direito", "direito"],
  diasGozados: ["dias gozados", "gozados", "dias de gozo"],
  abono: ["abono"],
};

/** Acha, para cada campo esperado, qual cabeçalho da planilha corresponde (por nome normalizado). */
function mapearCabecalhos(cabecalhos: string[]): Partial<Record<keyof LinhaImportacaoFerias, string>> {
  const normalizados = cabecalhos.map((c) => ({ original: c, norm: normalizar(c) }));
  const mapa: Partial<Record<keyof LinhaImportacaoFerias, string>> = {};

  (Object.keys(SINONIMOS) as (keyof LinhaImportacaoFerias)[]).forEach((campo) => {
    const encontrado = normalizados.find((c) => SINONIMOS[campo].some((s) => c.norm === s || c.norm.includes(s)));
    if (encontrado) mapa[campo] = encontrado.original;
  });

  return mapa;
}

/** "15/09/2025" ou "2025-09-15" → ISO. Retorna null se não reconhecer — nunca adivinha. */
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

function paraNumero(valor: string | number | null): number | null {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function paraBooleano(valor: string | number | null): boolean {
  if (valor === null) return false;
  const t = normalizar(String(valor));
  return t === "sim" || t === "s" || t === "true" || t === "1" || t === "x";
}

export interface ConversaoProgramacaoFerias {
  itens: LinhaImportacaoFerias[];
  descartadas: { linha: number; motivo: string }[];
}

/**
 * Converte as linhas de uma planilha (ou de um "melhor esforço" de texto
 * extraído de PDF, já normalizado no mesmo formato de linhas) em entradas
 * prontas para `importarProgramacaoFerias`. Colunas são identificadas
 * automaticamente pelo nome do cabeçalho — sem etapa de confirmação manual,
 * já que o modelo baixável define os nomes esperados.
 */
export function converterProgramacaoFerias(
  cabecalhos: string[],
  linhas: LinhaPlanilha[],
): ConversaoProgramacaoFerias {
  const mapa = mapearCabecalhos(cabecalhos);
  if (!mapa.nomeEmpregado) {
    throw new Error('Não foi possível identificar a coluna do empregado (ex.: "Empregado" ou "Nome").');
  }
  if (!mapa.aquisitivoInicio || !mapa.aquisitivoFim) {
    throw new Error('Não foi possível identificar as colunas de início/fim do período aquisitivo.');
  }

  const itens: LinhaImportacaoFerias[] = [];
  const descartadas: { linha: number; motivo: string }[] = [];

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2;
    const nomeEmpregado = String(linha[mapa.nomeEmpregado!] ?? "").trim();
    if (!nomeEmpregado) {
      descartadas.push({ linha: numeroLinha, motivo: "Nome do empregado ausente." });
      return;
    }

    const aquisitivoInicio = paraIso(linha[mapa.aquisitivoInicio!]);
    const aquisitivoFim = paraIso(linha[mapa.aquisitivoFim!]);
    if (!aquisitivoInicio || !aquisitivoFim) {
      descartadas.push({
        linha: numeroLinha,
        motivo: `Datas do período aquisitivo inválidas para "${nomeEmpregado}" (use DD/MM/AAAA).`,
      });
      return;
    }

    const diasDireito = mapa.diasDireito ? paraNumero(linha[mapa.diasDireito]) : 30;
    const diasGozados = mapa.diasGozados ? paraNumero(linha[mapa.diasGozados]) : 0;

    itens.push({
      codigo: mapa.codigo ? String(linha[mapa.codigo] ?? "").trim() || null : null,
      nomeEmpregado,
      aquisitivoInicio,
      aquisitivoFim,
      diasDireito: diasDireito ?? 30,
      diasGozados: diasGozados ?? 0,
      abono: mapa.abono ? paraBooleano(linha[mapa.abono]) : false,
    });
  });

  return { itens, descartadas };
}
