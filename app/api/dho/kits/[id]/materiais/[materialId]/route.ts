import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarMaterialKit } from "@/lib/db/dho";

export const runtime = "nodejs";

const schema = z.object({
  valor: z.number().min(0),
  quantidadeEstoque: z.number().int().min(0),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { materialId } = await params;
  await atualizarMaterialKit(Number(materialId), parsed.data);
  return Response.json({ ok: true });
}
