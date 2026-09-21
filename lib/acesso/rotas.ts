/**
 * Mapa de rotas (páginas e API) pros módulos de `modulos.ts`, usado pelo
 * Proxy pra decidir se um gestor pode entrar. Espelha `montarGrupos()` do
 * Sidebar (`components/nav/Sidebar.tsx`) e as `?aba=` de cada
 * `*PageClient.tsx` — mudou uma rota lá, ajusta aqui também.
 */

export interface RegraPagina {
  /** Caminho exato da página (sem query string). */
  caminho: string;
  /** Quando a página tem `?aba=`, o módulo exigido por valor de aba. */
  porAba?: Record<string, string>;
  /** Aba usada quando `?aba=` vem ausente ou com valor desconhecido. */
  abaPadrao?: string;
  /** Módulo exigido quando a página não se divide por aba. */
  modulo?: string;
}

export const ROTAS_PAGINA: RegraPagina[] = [
  {
    caminho: "/colaboradores",
    porAba: { quadro: "colaboradores.quadro", organograma: "colaboradores.organograma" },
    abaPadrao: "quadro",
  },
  { caminho: "/dashboard", modulo: "ferias.dashboard" },
  {
    caminho: "/ferias",
    porAba: { controle: "ferias.controle", planejamento: "ferias.planejamento" },
    abaPadrao: "controle",
  },
  {
    caminho: "/folha",
    porAba: { dashboard: "folha.dashboard", relatorio: "folha.relatorio" },
    abaPadrao: "dashboard",
  },
  {
    caminho: "/beneficios",
    porAba: { dashboard: "beneficios.dashboard", rateio: "beneficios.rateio" },
    abaPadrao: "dashboard",
  },
  { caminho: "/rescisao", modulo: "rescisao" },
  { caminho: "/chat", modulo: "chat" },
];

export interface RegraApi {
  /** Prefixo do caminho (`pathname === prefixo || pathname.startsWith(prefixo + "/")`). */
  prefixo: string;
  /**
   * Módulo/grupo exigido. Com ponto (`"ferias.controle"`) exige exatamente
   * essa chave; sem ponto (`"ferias"`) basta ALGUM submódulo daquele grupo
   * estar liberado — usado nas rotas de API que servem mais de uma aba da
   * mesma página e não dá pra saber qual daqui.
   */
  modulo: string;
}

/** Checado antes das outras: `/api/acesso-gestores*` é só pra administrador. */
export const PREFIXO_ADMIN = "/api/acesso-gestores";

export const ROTAS_API: RegraApi[] = [
  { prefixo: "/api/calc/rescisao", modulo: "rescisao" },
  { prefixo: "/api/calc/folha", modulo: "folha" },
  { prefixo: "/api/calc", modulo: "ferias" },
  { prefixo: "/api/dashboard", modulo: "ferias.dashboard" },
  { prefixo: "/api/periodos-aquisitivos", modulo: "ferias" },
  { prefixo: "/api/lancamentos-ferias", modulo: "ferias" },
  { prefixo: "/api/programacao-ferias", modulo: "ferias" },
  { prefixo: "/api/colaboradores", modulo: "colaboradores" },
  { prefixo: "/api/folha-breakdown", modulo: "folha" },
  { prefixo: "/api/beneficios", modulo: "beneficios" },
  { prefixo: "/api/upload", modulo: "folha" },
  { prefixo: "/api/ai", modulo: "folha" },
  { prefixo: "/api/chat", modulo: "chat" },
];

/**
 * `modulo` com ponto exige a chave exata; sem ponto, basta algum submódulo
 * daquele grupo (ou o próprio módulo-folha, pra rescisão/chat) estar liberado.
 */
export function permiteAcesso(modulo: string, liberados: Set<string>): boolean {
  if (liberados.has(modulo)) return true;
  if (modulo.includes(".")) return false;
  for (const chave of liberados) {
    if (chave === modulo || chave.startsWith(`${modulo}.`)) return true;
  }
  return false;
}

export function moduloDaPagina(regra: RegraPagina, aba: string | null): string | undefined {
  if (regra.porAba) {
    const chaveAba = aba && regra.porAba[aba] ? aba : regra.abaPadrao;
    return chaveAba ? regra.porAba[chaveAba] : undefined;
  }
  return regra.modulo;
}
