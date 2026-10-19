import type { SessaoPayload } from "./token";

/** Vê todos os colaboradores (com dados pessoais) e pode cadastrar/editar: administrador ou gestor-editor do RH. */
export function editaColaboradores(sessao: Pick<SessaoPayload, "tipo" | "editorColaboradores"> | null | undefined): boolean {
  return sessao?.tipo === "administrador" || sessao?.editorColaboradores === true;
}

type SessaoComModulos = Pick<SessaoPayload, "tipo" | "liberados">;

function liberadoNoPortal(sessao: SessaoComModulos | null | undefined, prefixo: "sst." | "dho."): boolean {
  if (!sessao) return false;
  return sessao.tipo === "administrador" || sessao.liberados.some((chave) => chave.startsWith(prefixo));
}

/** Entra no Portal SST: administrador ou gestor com ao menos um módulo `sst.*` liberado. Excluir continua só com o administrador. */
export function acessaSst<T extends SessaoComModulos>(sessao: T | null | undefined): sessao is T {
  return liberadoNoPortal(sessao, "sst.");
}

/** Entra no Portal ENDO (DHO): administrador ou gestor com ao menos um módulo `dho.*` liberado. Excluir continua só com o administrador. */
export function acessaDho<T extends SessaoComModulos>(sessao: T | null | undefined): sessao is T {
  return liberadoNoPortal(sessao, "dho.");
}
