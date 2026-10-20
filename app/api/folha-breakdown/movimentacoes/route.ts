import { z } from "zod";
import { obterHistoricoMovimentacoes, salvarInfoMovimentacao } from "@/lib/db/movimentacoes";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { ehEmailEditorMovimentacoes } from "@/lib/auth/admins";
import { tiposDoMovimento } from "@/lib/folha/movimentacoesTipos";
import { escopoColaboradoresDoGestor } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

const schemaAno = z.object({ ano: z.coerce.number().int().min(2000).max(2100) });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = schemaAno.safeParse({ ano: searchParams.get("ano") ?? new Date().getFullYear() });
  if (!parsed.success) {
    return Response.json({ erro: "Informe ?ano=AAAA." }, { status: 400 });
  }
  const sessao = await obterSessaoAtual();
  return Response.json(await obterHistoricoMovimentacoes(parsed.data.ano, !!sessao && ehEmailEditorMovimentacoes(sessao.email), await escopoColaboradoresDoGestor()));
}

const schemaSalvar = z.object({
  colaboradorId: z.coerce.number().int().positive(),
  movimento: z.enum(["entrada", "saida"]),
  tipo: z.string().trim().nullable(),
  justificativa: z.string().trim().max(500, "A justificativa aceita até 500 caracteres.").nullable(),
});

/** Classifica uma entrada ou saída (tipo + justificativa) — só Leslie e Carolina (ver ehEmailEditorMovimentacoes). */
export async function PATCH(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || !ehEmailEditorMovimentacoes(sessao.email)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaSalvar.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { colaboradorId, movimento, tipo, justificativa } = parsed.data;
  if (tipo && !tiposDoMovimento(movimento).includes(tipo)) {
    return Response.json({ erro: "Tipo de movimentação inválido." }, { status: 400 });
  }
  await salvarInfoMovimentacao({ colaboradorId, movimento, tipo: tipo || null, justificativa: justificativa || null });
  return Response.json({ ok: true });
}
