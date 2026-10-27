import { z } from "zod";
import { consumirLinkLogin } from "@/lib/db/loginLinks";
import { abrirSessaoGestor, gestorAtivoPorEmail } from "@/lib/auth/entradaGestor";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(20).max(100) });

/** Confirma o link do e-mail (POST, para scanners de e-mail que abrem links não o consumirem) e abre a sessão do gestor. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ erro: "Link inválido." }, { status: 400 });

  const email = await consumirLinkLogin(parsed.data.token);
  const gestor = email ? await gestorAtivoPorEmail(email) : null;
  if (!gestor) return Response.json({ erro: "Link inválido ou expirado. Peça um novo na tela de entrada." }, { status: 400 });

  await abrirSessaoGestor(gestor);
  return Response.json({ ok: true });
}
