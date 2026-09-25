import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarEventoCalendario, excluirEventoCalendario } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { id } = await params;
  await excluirEventoCalendario(Number(id));
  return Response.json({ ok: true });
}

const schemaPatch = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
  titulo: z.string().trim().min(1, "Informe um título."),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaPatch.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await params;
  const evento = await atualizarEventoCalendario(Number(id), parsed.data.data, parsed.data.titulo);
  return Response.json({ evento });
}
