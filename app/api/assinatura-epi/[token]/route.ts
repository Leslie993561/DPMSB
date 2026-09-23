import { z } from "zod";
import { assinarFicha, linkAssinatura, obterFichaPublica } from "@/lib/sst/fichas";

export const runtime = "nodejs";

// Rota pública (liberada em proxy.ts): quem assina não tem login no portal. O
// token do link — enviado ao e-mail profissional do colaborador — é a credencial.

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const documento = await obterFichaPublica((await params).token);
  if (!documento) return Response.json({ erro: "Link inválido." }, { status: 404 });
  // Link de uso único: depois de assinado (ou vencido) não devolve mais nada
  // da ficha — o documento assinado fica só com o RH.
  if (documento.status === "assinada") {
    return Response.json({ erro: "Esta ficha já foi assinada. Este link não está mais disponível." }, { status: 410 });
  }
  if (documento.expirada) {
    return Response.json({ erro: "Este link expirou. Peça ao RH um novo link de assinatura." }, { status: 410 });
  }
  return Response.json({ documento });
}

const schema = z.object({
  concordo: z.literal(true, { message: "É preciso marcar que leu e concorda com a declaração." }),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "—";
  try {
    const documento = await assinarFicha(token, {
      ip,
      link: linkAssinatura(new URL(request.url).origin, token),
    });
    return Response.json({ documento });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao assinar." }, { status: 400 });
  }
}
