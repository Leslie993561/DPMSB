import { z } from "zod";
import { buscarColaboradorPorEmail } from "@/lib/db/colaboradores";
import { ehEmailAdmin } from "@/lib/auth/admins";
import { criarTokenSessao, definirCookieSessao } from "@/lib/auth/sessao";
import { gestorAtivoPorEmail } from "@/lib/auth/entradaGestor";
import { criarLinkLogin } from "@/lib/db/loginLinks";
import { emailConfigurado, enviarEmail } from "@/lib/email";

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
      colaboradorId: colaborador?.id ?? null,
      liberados: [],
    });
    await definirCookieSessao(token, duracaoSegundos);
    return Response.json({ ok: true, tipo: "administrador" });
  }

  const gestor = await gestorAtivoPorEmail(email);
  if (!gestor) {
    return Response.json(
      { erro: "Este e-mail não está autorizado a acessar o Portal Recursos Humanos. Fale com o administrador." },
      { status: 403 },
    );
  }

  // Gestor não entra só digitando o e-mail: precisa confirmar por um link enviado à caixa dele.
  // Sem e-mail configurado NÃO há fallback para login direto — isso anularia a verificação.
  if (!emailConfigurado()) {
    return Response.json(
      { erro: "O envio do link de confirmação ainda não está configurado no portal. Fale com o administrador." },
      { status: 503 },
    );
  }

  const token = await criarLinkLogin(gestor.email);
  const origem = process.env.PORTAL_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  const link = `${origem}/login/confirmar?token=${token}`;
  try {
    await enviarEmail({
      para: gestor.email,
      assunto: "Confirme sua entrada no Portal Recursos Humanos",
      texto: `Olá, ${gestor.nome}.\n\nPara entrar no Portal Recursos Humanos, abra o link abaixo e confirme (vale por 15 minutos e só pode ser usado uma vez):\n${link}\n\nSe não foi você, ignore este e-mail.`,
      html: `<p>Olá, ${gestor.nome.replace(/</g, "&lt;")}.</p><p>Para entrar no <strong>Portal Recursos Humanos</strong>, clique no botão abaixo e confirme a entrada. O link vale por 15 minutos e só pode ser usado uma vez.</p><p><a href="${link}" style="display:inline-block;background:#4f9cb5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Confirmar entrada</a></p><p style="color:#666;font-size:12px">Se não foi você quem pediu, ignore este e-mail.</p>`,
    });
  } catch {
    return Response.json({ erro: "Não foi possível enviar o e-mail de confirmação. Tente novamente." }, { status: 502 });
  }
  return Response.json({ ok: true, aguardandoConfirmacao: true, email: gestor.email });
}
