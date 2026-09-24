/**
 * Lógica de domínio do Portal SST, portada de `portal-sst/src/domain/*.ts` —
 * funções puras (sem dependência de UI/estado/Supabase), traduzidas aqui
 * pra ler das linhas de SQL do Postgres do SST em vez do reducer em memória
 * do app antigo. As regras de negócio (limiares de status, contagem de dias)
 * são as MESMAS do original — só a fonte do dado mudou.
 *
 * Fontes portadas:
 * - domain/dates.ts     → parseBR, isoToBR, mesISOfromBR, mesAbrev, idadeFromISO
 * - domain/text.ts      → titleCase, deptName, normalizeCargo
 * - domain/exameStatus.ts → StatusExame, computeExameStatus, statusDoRegistro, toneForStatus, pcmsoIdadeMinFor
 * - domain/fichaAssinatura.ts → statusFichaEpi
 * - domain/programaStatus.ts → computeProgramaStatus, versoesMaisRecentes
 */

// ---------- datas (portal-sst/src/domain/dates.ts) ----------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Datas do SST circulam em dd/mm/aaaa (texto) na base — mesmo formato do original. */
export function parseBR(value: string | null | undefined): Date | null {
  if (!value || value === "—") return null;
  const parts = String(value).split("/");
  if (parts.length < 3) return null;
  const [d, m, y] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Converte um valor vindo de coluna `date` do Postgres (que o driver `pg` entrega como `Date`) ou uma string ISO/TEXT para "aaaa-mm-dd". */
export function pgValueToIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const texto = String(value);
  // já pode vir como "aaaa-mm-ddTHH:mm:ss..." de algum driver — corta na parte da data.
  return texto.slice(0, 10);
}

export function isoToBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length < 3) return "—";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function mesISOfromBR(value: string | null | undefined): string {
  const d = parseBR(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Idade calculada a partir da data de nascimento (ISO aaaa-mm-dd). */
export function idadeFromISO(iso: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!iso) return null;
  const parts = String(iso).split("-");
  if (parts.length < 3) return null;
  const [y, m, d] = parts.map(Number);
  const nascimento = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(nascimento.getTime())) return null;
  let idade = hoje.getFullYear() - nascimento.getUTCFullYear();
  const diffMes = hoje.getMonth() + 1 - (nascimento.getUTCMonth() + 1);
  if (diffMes < 0 || (diffMes === 0 && hoje.getDate() < nascimento.getUTCDate())) idade--;
  return idade >= 0 && idade < 120 ? idade : null;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function mesAbrev(indexBase1: number): string {
  return MESES[indexBase1 - 1] ?? "";
}

// ---------- texto (portal-sst/src/domain/text.ts) ----------

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/(^|\s|\/|-)([a-zà-ÿ])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** Normaliza nomes de cargo/função para comparação (acentos fora, sufixo de senioridade fora, "(a)" fora). */
export function normalizeCargo(value: string | null | undefined): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s*\(A\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*(I{1,3}|JR|JÚNIOR|SR|SÊNIOR|PLENO)\s*$/, "")
    .trim();
}

export function deptName(value: string | null | undefined): string {
  return value || "Sem classificação";
}

// ---------- status de exame (portal-sst/src/domain/exameStatus.ts) ----------

export type StatusExame = "Em dia" | "A vencer" | "Vencido" | "Necessita revisão" | "Pendente";

export interface ExameRegistro {
  proc: string;
  ultimo: string; // dd/mm/aaaa ou "—"
  proximo: string; // dd/mm/aaaa
  status?: string;
}

export interface CatalogoExameOcupacional {
  codigo: string;
  nome: string;
  cargos: number;
  obs: string[];
  valor: number;
}

export interface ContextoIdadeExame {
  idadeColab: number | null;
  catalogo: CatalogoExameOcupacional[];
}

export function computeExameStatus(proximaBR: string | null | undefined, hoje: Date = new Date()): StatusExame {
  const proxima = parseBR(proximaBR);
  if (!proxima) return "Necessita revisão";
  if (proxima.getFullYear() > hoje.getFullYear() + 3) return "Necessita revisão";
  const dias = Math.round((proxima.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return "Vencido";
  if (dias <= 60) return "A vencer";
  return "Em dia";
}

export function statusDoRegistro(exame: ExameRegistro, hoje: Date = new Date(), contexto?: ContextoIdadeExame): StatusExame {
  const semRegistro = !exame.ultimo || exame.ultimo === "—";
  if (semRegistro && contexto) {
    const idadeMin = pcmsoIdadeMinFor(exame.proc, contexto.catalogo);
    if (idadeMin != null && (contexto.idadeColab == null || contexto.idadeColab < idadeMin)) return "Em dia";
  }
  if (semRegistro) return "Pendente";
  return computeExameStatus(exame.proximo, hoje);
}

export type BadgeTone = "success" | "warning" | "danger" | "purple" | "info" | "neutral";

export function toneForStatus(status: StatusExame): BadgeTone {
  switch (status) {
    case "Em dia":
      return "success";
    case "A vencer":
    case "Pendente":
      return "warning";
    case "Necessita revisão":
      return "purple";
    case "Vencido":
      return "danger";
    default:
      return "neutral";
  }
}

/** Extrai a idade mínima exigida (critério do PCMSO) para um exame, se houver. */
export function pcmsoIdadeMinFor(proc: string, catalogo: CatalogoExameOcupacional[]): number | null {
  const codigo = /\((\d+)\)/.exec(proc)?.[1];
  let entrada = codigo ? catalogo.find((c) => c.codigo === codigo) : undefined;
  if (!entrada) {
    const nomeNormalizado = normalizeCargo(proc);
    entrada = catalogo.find((c) => c.nome && nomeNormalizado.includes(normalizeCargo(c.nome)));
  }
  if (!entrada) return null;
  const match = /a partir de\s*(\d+)\s*anos/i.exec((entrada.obs ?? []).join(" "));
  return match ? Number(match[1]) : null;
}

// ---------- ficha de EPI (portal-sst/src/domain/fichaAssinatura.ts) ----------

export type StatusFichaEpi = "assinada" | "aguardando";

export function statusFichaEpi(assinaturaStoragePath: string | null | undefined): StatusFichaEpi {
  return assinaturaStoragePath ? "assinada" : "aguardando";
}

// ---------- programas de saúde ocupacional (portal-sst/src/domain/programaStatus.ts) ----------

export type StatusPrograma = "Vigente" | "Próximo do vencimento" | "Vencido";
export type PrecisaoData = "dia" | "mes";

const JANELA_ALERTA_DIAS = 90;

function parseDataPrograma(valor: string, precisao: PrecisaoData): Date | null {
  if (!valor) return null;
  if (precisao === "mes") {
    const m = /^(\d{4})-(\d{2})$/.exec(valor);
    if (!m) return null;
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12) return null;
    return new Date(ano, mes, 0); // último dia do mês informado
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function diasRestantesPrograma(vigenciaFim: string, precisaoFim: PrecisaoData, hoje: Date = new Date()): number | null {
  const data = parseDataPrograma(vigenciaFim, precisaoFim);
  if (!data) return null;
  const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((data.getTime() - hojeSemHora.getTime()) / 86_400_000);
}

export function computeProgramaStatus(vigenciaFim: string, precisaoFim: PrecisaoData, hoje: Date = new Date()): StatusPrograma {
  const dias = diasRestantesPrograma(vigenciaFim, precisaoFim, hoje);
  if (dias === null) return "Vencido";
  if (dias < 0) return "Vencido";
  if (dias <= JANELA_ALERTA_DIAS) return "Próximo do vencimento";
  return "Vigente";
}

export interface ProgramaSaudeVersao {
  programa: string;
  vigenciaFim: string;
  precisaoFim: PrecisaoData;
  ts: string;
}

/** Última versão de cada programa (PCMSO/PGR), pela vigência mais recente. */
export function versoesMaisRecentes<T extends ProgramaSaudeVersao>(programas: T[]): T[] {
  const porPrograma = new Map<string, T>();
  for (const p of programas) {
    const atual = porPrograma.get(p.programa);
    if (!atual || p.vigenciaFim > atual.vigenciaFim || (p.vigenciaFim === atual.vigenciaFim && p.ts > atual.ts)) {
      porPrograma.set(p.programa, p);
    }
  }
  return [...porPrograma.values()];
}

// ---------- catálogo de exames ocupacionais (portal-sst/src/data/matrizOcupacional.json → catalogoExames) ----------

/**
 * Só o catálogo de EXAMES (12 itens) — é o único pedaço da Matriz Ocupacional
 * estática usado pelo Dashboard (previsto x realizado + idade mínima do
 * PCMSO). O restante da matriz (cargos, riscos, EPIs) não é lido aqui;
 * o original também mantém isso como JSON estático (não vem do Supabase).
 */
export const CATALOGO_EXAMES_OCUPACIONAIS: CatalogoExameOcupacional[] = [
  { codigo: "0295", nome: "AVALIAÇÃO CLINICA OCUPACIONAL", valor: 20, cargos: 55, obs: [] },
  { codigo: "0673", nome: "GRUPO SANGUÍNEO / FATOR RH", valor: 14.8, cargos: 55, obs: [] },
  {
    codigo: "0530",
    nome: "ECG",
    valor: 30,
    cargos: 55,
    obs: [
      "Somente para colaboradores a partir de 40 anos (ambos os sexos). A cada 12 meses",
      "Recomendamos que só deverão fazer o Eletrocardiograma (ECG) os colaboradores que tiverem à",
    ],
  },
  { codigo: "1410", nome: "RAIO X - COLUNA LOMBAR", valor: 42, cargos: 17, obs: [] },
  { codigo: "0693", nome: "HEMOGRAMA COMPLETO", valor: 15, cargos: 13, obs: [] },
  { codigo: "0296", nome: "ACUIDADE VISUAL", valor: 22.5, cargos: 13, obs: [] },
  { codigo: "1057", nome: "ESPIROMETRIA", valor: 28, cargos: 13, obs: [] },
  { codigo: "1086", nome: "RETICULOCITOS", valor: 7, cargos: 13, obs: [] },
  {
    codigo: "0281",
    nome: "AUDIOMETRIA TONAL",
    valor: 25,
    cargos: 12,
    obs: [
      "A AUDIOMETRIA deve ser realizada na admissão, no 6º mês após a admissão e, no periódico, a cada 6 meses — APENAS para cargos expostos a ruído.",
    ],
  },
  { codigo: "0658", nome: "GLICEMIA", valor: 0, cargos: 2, obs: [] },
  { codigo: "0300", nome: "AVALIAÇÃO PSICOSSOCIAL", valor: 0, cargos: 2, obs: [] },
  { codigo: "0536", nome: "EEG", valor: 0, cargos: 2, obs: [] },
  // Sem código numérico na planilha original da Matriz Ocupacional — só entra
  // pra Líder de Manutenção e Técnico em Manutenção Geral.
  { codigo: "", nome: "TESTE DE ROMBERG", valor: 0, cargos: 2, obs: [] },
];
