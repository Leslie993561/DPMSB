/**
 * Árvore de módulos/submódulos de CADA portal (DP, SST, DHO) usada no
 * controle de acesso de gestores. As chaves espelham as rotas reais do
 * Sidebar (`components/nav/Sidebar.tsx`) — mudou uma lá, muda aqui também,
 * senão a tela de permissões libera algo que não existe mais ou esquece algo
 * novo.
 *
 * Gestor liberado num módulo só VÊ os dados (GET) — cadastrar, editar e
 * excluir continuam exclusivos do administrador, mesmo padrão já usado nos
 * módulos do Portal DP (ex.: só admin cadastra colaborador).
 */
export interface ModuloAcesso {
  chave: string;
  label: string;
  filhos?: ModuloAcesso[];
}

export interface PortalAcesso {
  chave: "dp" | "sst" | "dho";
  label: string;
  modulos: ModuloAcesso[];
}

const MODULOS_DP: ModuloAcesso[] = [
  {
    chave: "colaboradores",
    label: "Colaboradores",
    filhos: [
      { chave: "colaboradores.quadro", label: "Quadro de colaboradores" },
      { chave: "colaboradores.organograma", label: "Organograma" },
    ],
  },
  {
    chave: "ferias",
    label: "Férias",
    filhos: [
      { chave: "ferias.dashboard", label: "Dashboard" },
      { chave: "ferias.controle", label: "Controle de Férias" },
      { chave: "ferias.planejamento", label: "Planejamento de Férias" },
    ],
  },
  {
    chave: "folha",
    label: "Breakdown de Folha",
    filhos: [
      { chave: "folha.dashboard", label: "Dashboard" },
      { chave: "folha.relatorio", label: "Relatório detalhado" },
    ],
  },
  {
    chave: "beneficios",
    label: "Benefícios",
    filhos: [
      { chave: "beneficios.dashboard", label: "Dashboard" },
      { chave: "beneficios.rateio", label: "Rateio" },
    ],
  },
  { chave: "rescisao", label: "Rescisão" },
  { chave: "chat", label: "Chat com o Assistente" },
];

const MODULOS_SST: ModuloAcesso[] = [
  { chave: "sst.dashboard", label: "Dashboard" },
  { chave: "sst.epi", label: "Gestão de EPI" },
  { chave: "sst.exames", label: "Exames Ocupacionais" },
  { chave: "sst.programas", label: "Programas SST" },
];

const MODULOS_DHO: ModuloAcesso[] = [
  { chave: "dho.dashboard", label: "Endomarketing · Dashboard" },
  { chave: "dho.kits", label: "Endomarketing · Estoque de Kits" },
];

export const PORTAIS_ACESSO: PortalAcesso[] = [
  { chave: "dp", label: "Portal DP", modulos: MODULOS_DP },
  { chave: "sst", label: "Portal SST", modulos: MODULOS_SST },
  { chave: "dho", label: "Portal DHO", modulos: MODULOS_DHO },
];

/** Mantido pelo nome antigo — só o Portal DP, pra quem já importava a lista solta. */
export const MODULOS_PORTAL = MODULOS_DP;

/** Todas as chaves (pais e filhos) de todos os portais — usado pra validar o que chega da API. */
export function todasAsChaves(modulos: ModuloAcesso[] = PORTAIS_ACESSO.flatMap((p) => p.modulos)): string[] {
  return modulos.flatMap((m) => [m.chave, ...(m.filhos ? todasAsChaves(m.filhos) : [])]);
}
