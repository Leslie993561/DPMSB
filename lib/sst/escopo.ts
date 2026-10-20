/**
 * Escopo por equipe nas consultas do SST: `null` = empresa inteira (administrador
 * ou gestor-editor do RH, comportamento de sempre); `Set` = só esses
 * `colaboradores.id` (gestor comum, só a própria liderança). Vem de
 * `escopoColaboradoresDoGestor()` (lib/acesso/equipeGestor.ts).
 */
export type EscopoColaboradores = Set<number> | null;

/** true se o colaborador entra no escopo (aceita id numérico ou string vinda do Postgres). */
export function emEscopo(escopo: EscopoColaboradores, colaboradorId: number | string): boolean {
  return escopo === null || escopo.has(Number(colaboradorId));
}
