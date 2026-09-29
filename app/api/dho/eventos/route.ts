import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { criarEventoCalendario, listarEventosCalendario } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ eventos: await listarEventosCalendario(ano) });
}

const schemaItem = z.object({
  tema: z.string().trim().min(1).nullable().optional(),
  nome: z.string().trim().min(1, "Informe o nome do item."),
  quantidade: z.number().int().min(1),
  valorUnitario: z.number().min(0),
});

export const schemaEvento = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD para o início."),
  dataFim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD para o fim.")
    .nullable()
    .optional(),
  titulo: z.string().trim().min(1, "Informe um título."),
  objetivo: z.string().trim().optional().default(""),
  publicoAlvo: z.string().trim().optional().default(""),
  descricao: z.string().trim().optional().default(""),
  itens: z.array(schemaItem).optional().default([]),
});

export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaEvento.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const evento = await criarEventoCalendario({ ...parsed.data, dataFim: parsed.data.dataFim ?? null });
  return Response.json({ evento }, { status: 201 });
}
