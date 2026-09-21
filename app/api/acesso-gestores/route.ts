import { z } from "zod";
import { criarGestorAcesso, ErroValidacaoGestor, listarGestoresAcesso } from "@/lib/db/acessoGestores";

export const runtime = "nodejs";

const schema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  email: z.string().email("Informe um e-mail corporativo válido."),
});

export async function GET() {
  return Response.json({ gestores: await listarGestoresAcesso() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const gestor = await criarGestorAcesso(parsed.data);
    return Response.json({ gestor }, { status: 201 });
  } catch (erro) {
    if (erro instanceof ErroValidacaoGestor) {
      return Response.json({ erro: erro.message }, { status: 400 });
    }
    throw erro;
  }
}
