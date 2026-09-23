import { z } from "zod";
import { assinarFicha, linkAssinatura, obterFichaPublica } from "@/lib/sst/fichas";

export const runtime = "nodejs";

// Rota pública (liberada em proxy.ts): quem assina não tem login no portal. O
// token do link é a credencial, e o e-mail profissional confirma a pessoa.

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const documento = await obterFichaPublica((await params).token);
  if (!documento) return Response.json({ erro: "Link inválido." }, { status: 404 });
  return Response.json({ documento });
}

const schema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  rg: z.string().trim().min(3, "Informe o seu RG."),
  concordo: z.literal(true, { message: "É preciso concordar com a declaração." }),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "—";
  try {
    const documento = await assinarFicha(token, parsed.data, {
      ip,
      link: linkAssinatura(new URL(request.url).origin, token),
    });
    return Response.json({ documento });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao assinar." }, { status: 400 });
  }
}
