import "server-only";
import { buscarColaboradorPorEmail } from "@/lib/db/colaboradores";
import { buscarGestorAcessoPorEmail, listarPermissoesGestor, type GestorAcesso } from "@/lib/db/acessoGestores";
import { ehEmailEditorColaboradores } from "./admins";
import { criarTokenSessao, definirCookieSessao } from "./sessao";

/** Gestor cadastrado e ativo para o e-mail, ou null. */
export async function gestorAtivoPorEmail(email: string): Promise<GestorAcesso | null> {
  const gestor = await buscarGestorAcessoPorEmail(email);
  return gestor && gestor.status === "ativo" ? gestor : null;
}

/** Abre a sessão do gestor (cookie) com as permissões atuais dele. */
export async function abrirSessaoGestor(gestor: GestorAcesso): Promise<void> {
  const colaborador = gestor.colaboradorId ? await buscarColaboradorPorEmail(gestor.email) : null;
  const liberados = await listarPermissoesGestor(gestor.id);
  const { token, duracaoSegundos } = await criarTokenSessao({
    email: gestor.email,
    nome: gestor.nome,
    cargo: colaborador?.cargo ?? null,
    tipo: "gestor",
    gestorId: gestor.id,
    colaboradorId: gestor.colaboradorId,
    liberados,
    editorColaboradores: ehEmailEditorColaboradores(gestor.email),
  });
  await definirCookieSessao(token, duracaoSegundos);
}
