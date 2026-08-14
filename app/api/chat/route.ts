import { z } from "zod";
import { runChatTurn } from "@/lib/ai/toolLoop";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  let resultado;
  try {
    resultado = await runChatTurn(parsed.data.messages);
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Erro desconhecido ao consultar o assistente.";
    return Response.json({ erro: mensagem }, { status: 502 });
  }

  const textBlocks = resultado.message.content.filter((b) => b.type === "text");
  const texto = textBlocks.map((b) => b.text).join("\n\n");

  return Response.json({
    texto,
    toolCalls: resultado.toolCalls,
  });
}
