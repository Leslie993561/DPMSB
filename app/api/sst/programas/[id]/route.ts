import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { atualizarVersaoPrograma } from "@/lib/sst/programas";

export const runtime = "nodejs";

const schemaPatch = z.object({
  vigenciaInicio: z.string().min(1, "Informe a data de início."),
  vigenciaFim: z.string().min(1, "Informe o vencimento."),
  precisaoFim: z.enum(["dia", "mes"]),
  autor: z.string().trim().min(1, "Informe o autor/responsável técnico."),
  anexoUrl: z.string().optional().nullable(),
  anexoNome: z.string().optional().nullable(),
});

/** Corrige os dados de uma versão já lançada — não cria uma nova versão, só ajusta a existente. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaPatch.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await params;
  const ok = await atualizarVersaoPrograma(id, parsed.data);
  if (!ok) return Response.json({ erro: "Versão não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
