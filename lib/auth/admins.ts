/** Sem tabela própria de propósito: hoje só existe uma pessoa administrando o acesso, e é config de ambiente, não dado de negócio. */
export function ehEmailAdmin(email: string): boolean {
  const lista = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}

/**
 * Gestoras do RH que veem e editam TODOS os colaboradores sem serem administradoras
 * (não gerenciam acesso, nem SST/DHO, nem excluem). Config de ambiente, como ADMIN_EMAILS.
 */
export function ehEmailEditorColaboradores(email: string): boolean {
  const lista = (process.env.EDITORES_COLABORADORES_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}
