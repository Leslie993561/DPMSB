import { obterSessaoAtual } from "@/lib/auth/sessao";
import { z } from "zod";
import { atualizarFichaExame, excluirFichaExame, TIPOS_ASO } from "@/lib/sst/exames";

export const runtime = "nodejs";

async function ehAdmin() {
  return (await obterSessaoAtual())?.tipo === "administrador";
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schemaEdicao = z.object({
  tipoAso: z.enum(TIPOS_ASO.map((t) => t.valor) as [string, ...string[]]),
  exames: z.array(z.object({ exame: z.string().trim().min(1), dataRealizacao: dataIso })).min(1, "Selecione ao menos um exame."),
});

/** RH edita o tipo e os exames de uma ficha já registrada. Admin-only. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const parsed = schemaEdicao.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  try {
    const ok = await atualizarFichaExame((await params).id, {
      tipoAso: parsed.data.tipoAso,
      exames: parsed.data.exames.map((e) => ({
        exame: e.exame,
        dataRealizacao: `${e.dataRealizacao.slice(8, 10)}/${e.dataRealizacao.slice(5, 7)}/${e.dataRealizacao.slice(0, 4)}`,
      })),
    });
    if (!ok) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const apagada = await excluirFichaExame((await params).id);
  if (!apagada) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
