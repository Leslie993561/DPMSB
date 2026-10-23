import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaDho } from "@/lib/auth/perfil";
import { criarMelhoriaEmpresa, listarMelhoriasEmpresa } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const ano = Number(new URL(request.url).searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ melhorias: await listarMelhoriasEmpresa(ano) });
}

export const schemaMelhoria = z.object({
  data: z.string().regex(/^d{4}-d{2}-d{2}$/, "Informe a data."),
  titulo: z.string().trim().min(1, "Informe o título."),
  quantidade: z.number().int().min(1, "A quantidade deve ser ao menos 1."),
  valorTotal: z.number().min(0, "Informe o valor total."),
});

export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!acessaDho(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  // Aceita vários de uma vez ("adicionar outro" no formulário).
  const parsed = z.object({ itens: z.array(schemaMelhoria).min(1).max(50) }).safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const itens = [];
  for (const d of parsed.data.itens) itens.push(await criarMelhoriaEmpresa(d));
  return Response.json({ itens }, { status: 201 });
}
