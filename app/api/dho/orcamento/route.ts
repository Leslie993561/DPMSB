import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { definirOrcamentoMensal, obterOrcamentoAnual } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ meses: await obterOrcamentoAnual(ano) });
}

const schema = z.object({
  ano: z.number().int(),
  mes: z.number().int().min(1).max(12),
  aprovado: z.number().min(0),
});

export async function PATCH(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  await definirOrcamentoMensal(parsed.data.ano, parsed.data.mes, parsed.data.aprovado);
  return Response.json({ ok: true });
}
