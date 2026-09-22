/**
 * Árvore de módulos/submódulos do Portal Recursos Humanos usada no controle de acesso de
 * gestores. As chaves espelham as rotas reais do Sidebar (`components/nav/Sidebar.tsx`)
 * — mudou uma lá, muda aqui também, senão a tela de permissões libera algo
 * que não existe mais ou esquece algo novo.
 */
export interface ModuloAcesso {
  chave: string;
  label: string;
  filhos?: ModuloAcesso[];
}

export const MODULOS_PORTAL: ModuloAcesso[] = [
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

/** Todas as chaves (pais e filhos) — usado para validar o que chega da API. */
export function todasAsChaves(modulos: ModuloAcesso[] = MODULOS_PORTAL): string[] {
  return modulos.flatMap((m) => [m.chave, ...(m.filhos ? todasAsChaves(m.filhos) : [])]);
}
