/**
 * Composição dos benefícios por setor — compartilhada entre o dashboard de
 * Benefícios (tela) e a exportação para Excel, para os dois nunca divergirem.
 */

export type MacroSetor = "Produção" | "Administrativo";

/**
 * Agrupamento em 2 macro-categorias (visão executiva do Dashboard) — setores
 * de chão de fábrica/operação caem em "Produção", áreas de escritório/apoio
 * em "Administrativo". Mapeamento nosso, não vem do cadastro; o Rateio (aba
 * ao lado) continua mostrando o departamento real de cada colaborador.
 */
const MACRO_SETOR: Record<string, MacroSetor> = {
  Produção: "Produção",
  Manutenção: "Produção",
  Engenharia: "Produção",
  "Controle da Qualidade": "Produção",
  "Garantia da Qualidade": "Produção",
  Logística: "Produção",
  Industrial: "Produção",
  Administrativo: "Administrativo",
  "Recursos Humanos": "Administrativo",
  Financeiro: "Administrativo",
  Contábil: "Administrativo",
  Comercial: "Administrativo",
  Diretoria: "Administrativo",
  Planejamento: "Administrativo",
  "Operações de Vendas": "Administrativo",
  "Tecnologia da Informacao": "Administrativo",
};

/**
 * Onde o custo do colaborador é rateado.
 *
 * O centro informado no D365 manda: é classificação contábil, feita por quem
 * responde por ela. O mapa por departamento é só o palpite de quando o campo
 * está vazio — e "Administrativo" como último caso significa "não sabemos",
 * que foi como a Ourivania, sem setor nenhum, virou administrativa em silêncio.
 */
export function macroSetor(departamento: string | null, rateioD365?: string | null): MacroSetor {
  if (rateioD365 === "PRO") return "Produção";
  if (rateioD365 === "ADM") return "Administrativo";
  return (departamento && MACRO_SETOR[departamento]) || "Administrativo";
}

export interface LinhaParaComposicao {
  departamento: string | null;
  rateioD365: string | null;
  tipoTransporte: string;
  valeTransporte: number;
  valeAlimentacao: number;
  variaveis: number;
  bonificacao: number | null;
  outrosCustos: number | null;
}

export function totalBrindes(l: Pick<LinhaParaComposicao, "bonificacao" | "outrosCustos">): number {
  return (l.bonificacao ?? 0) + (l.outrosCustos ?? 0);
}

export interface ComposicaoSetor {
  setor: MacroSetor;
  colaboradores: number;
  vt: number;
  vm: number;
  vr: number;
  variaveis: number;
  total: number;
}

/** Produção e Administrativo, nessa ordem — transporte e mobilidade em linhas separadas. */
export function comporPorSetor(linhas: LinhaParaComposicao[]): ComposicaoSetor[] {
  const vazio = { vt: 0, vm: 0, vr: 0, variaveis: 0, colaboradores: 0 };
  const mapa = new Map<MacroSetor, typeof vazio>([
    ["Produção", { ...vazio }],
    ["Administrativo", { ...vazio }],
  ]);
  for (const l of linhas) {
    const chave = macroSetor(l.departamento, l.rateioD365);
    const atual = mapa.get(chave)!;
    mapa.set(chave, {
      vt: atual.vt + (l.tipoTransporte === "vm_fixo" ? 0 : l.valeTransporte),
      vm: atual.vm + (l.tipoTransporte === "vm_fixo" ? l.valeTransporte : 0),
      vr: atual.vr + l.valeAlimentacao,
      variaveis: atual.variaveis + l.variaveis + totalBrindes(l),
      colaboradores: atual.colaboradores + 1,
    });
  }
  return Array.from(mapa.entries()).map(([setor, v]) => ({
    setor,
    ...v,
    total: v.vt + v.vm + v.vr + v.variaveis,
  }));
}
