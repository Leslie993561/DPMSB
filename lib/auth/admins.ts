/** Sem tabela própria de propósito: hoje só existe uma pessoa administrando o acesso, e é config de ambiente, não dado de negócio. */
export function ehEmailAdmin(email: string): boolean {
  const lista = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}
