import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaSst } from "@/lib/auth/perfil";
import { dentroDoEscopo } from "@/lib/acesso/equipeGestor";
import { atualizarFicha, excluirFicha, obterColaboradorIdDaFicha, obterDocumentoFicha } from "@/lib/sst/fichas";

export const runtime = "nodejs";

async function ehAdmin() {
  return acessaSst(await obterSessaoAtual());
}

/** Documento da ficha com o comprovante de assinatura — só o RH vê. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const id = (await params).id;
  // Ficha de quem não é da equipe do gestor: 404, sem revelar que existe.
  const dono = await obterColaboradorIdDaFicha(id);
  if (dono !== null && !(await dentroDoEscopo(dono))) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  const documento = await obterDocumentoFicha(id);
  if (!documento) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ documento });
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schemaEdicao = z.object({
  itens: z
    .array(
      z.object({
        epi: z.string().trim().min(1),
        qtd: z.number().int().min(1).default(1),
        ca: z.string().trim().default(""),
        dataEntrega: dataIso,
        dataTroca: dataIso.nullable(),
      }),
    )
    .default([]),
  fardamento: z
    .array(z.object({ tipo: z.string().trim().min(1), qtd: z.number().int().min(1).default(1), dataEntrega: dataIso }))
    .default([]),
});

/** RH edita os itens de uma ficha ainda aguardando assinatura. Admin-only. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaEdicao.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    await atualizarFicha((await params).id, parsed.data);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao salvar." }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await obterSessaoAtual())?.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const apagada = await excluirFicha((await params).id);
  if (!apagada) return Response.json({ erro: "Ficha não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
