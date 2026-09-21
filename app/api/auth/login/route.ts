import { z } from "zod";
import { buscarColaboradorPorEmail } from "@/lib/db/colaboradores";
import { buscarGestorAcessoPorEmail, listarPermissoesGestor } from "@/lib/db/acessoGestores";
import { ehEmailAdmin } from "@/lib/auth/admins";
import { criarTokenSessao, definirCookieSessao } from "@/lib/auth/sessao";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email("Informe um e-mail corporativo válido.") });

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "E-mail inválido." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  if (ehEmailAdmin(email)) {
    const colaborador = await buscarColaboradorPorEmail(email);
    const { token, duracaoSegundos } = await criarTokenSessao({
      email,
      nome: colaborador?.nome ?? email,
      cargo: colaborador?.cargo ?? "Administrador",
      tipo: "administrador",
      gestorId: null,
      liberados: [],
    });
    await definirCookieSessao(token, duracaoSegundos);
    return Response.json({ ok: true, tipo: "administrador" });
  }

  const gestor = await buscarGestorAcessoPorEmail(email);
  if (!gestor || gestor.status !== "ativo") {
    return Response.json(
      { erro: "Este e-mail não está autorizado a acessar o Portal DP. Fale com o administrador." },
      { status: 403 },
    );
  }

  const colaborador = gestor.colaboradorId ? await buscarColaboradorPorEmail(gestor.email) : null;
  const liberados = await listarPermissoesGestor(gestor.id);

  const { token, duracaoSegundos } = await criarTokenSessao({
    email: gestor.email,
    nome: gestor.nome,
    cargo: colaborador?.cargo ?? null,
    tipo: "gestor",
    gestorId: gestor.id,
    liberados,
  });
  await definirCookieSessao(token, duracaoSegundos);
  return Response.json({ ok: true, tipo: "gestor" });
}
