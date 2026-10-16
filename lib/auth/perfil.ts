import type { SessaoPayload } from "./token";

/** Vê todos os colaboradores (com dados pessoais) e pode cadastrar/editar: administrador ou gestor-editor do RH. */
export function editaColaboradores(sessao: Pick<SessaoPayload, "tipo" | "editorColaboradores"> | null | undefined): boolean {
  return sessao?.tipo === "administrador" || sessao?.editorColaboradores === true;
}
