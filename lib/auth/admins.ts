/** Sem tabela própria de propósito: hoje só existe uma pessoa administrando o acesso, e é config de ambiente, não dado de negócio. */
export function ehEmailAdmin(email: string): boolean {
  const lista = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}

/**
 * Gestor-editor do RH que vale em qualquer ambiente, somado ao que vier da variável de
 * ambiente — sem isso, quem ficasse fora da variável em produção entrava como gestor
 * comum e só enxergava a própria equipe (o Yuri, do DP, via a lista vazia).
 */
const EDITORES_COLABORADORES_FIXOS = ["yuri.crispim@msbbrasil.com"];

/**
 * Gestoras do RH que veem e editam TODOS os colaboradores sem serem administradoras
 * (não gerenciam acesso, nem SST/DHO, nem excluem). Config de ambiente, como ADMIN_EMAILS.
 */
export function ehEmailEditorColaboradores(email: string): boolean {
  const lista = [...EDITORES_COLABORADORES_FIXOS, ...(process.env.EDITORES_COLABORADORES_EMAILS ?? "").split(",")]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}

/** Quem classifica entradas e saídas (tipo e justificativa) no Histórico de movimentações: só estas pessoas do RH. */
const EDITORES_MOVIMENTACOES_PADRAO =
  "leslie.souza@msbbrasil.com,carolina.cruz@msbbrasil.com,yuri.crispim@msbbrasil.com";

export function ehEmailEditorMovimentacoes(email: string): boolean {
  const lista = (process.env.EDITORES_MOVIMENTACOES_EMAILS ?? EDITORES_MOVIMENTACOES_PADRAO)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}
