import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { enviarKit } from "@/lib/db/dho";

export const runtime = "nodejs";

const schema = z.object({
  colaboradorId: z.number().int().positive(),
  materiaisIds: z.array(z.number().int().positive()).min(1, "Selecione ao menos um material."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await params;
  try {
    await enviarKit({
      kitId: Number(id),
      colaboradorId: parsed.data.colaboradorId,
      materiaisIds: parsed.data.materiaisIds,
      responsavel: sessao.nome,
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao registrar entrega." }, { status: 400 });
  }
}
