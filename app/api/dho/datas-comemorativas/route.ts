import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { criarDataComemorativa, listarDatasComemorativas } from "@/lib/db/dho";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  return Response.json({ datas: await listarDatasComemorativas(ano) });
}

export const schemaDataComemorativa = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
  nome: z.string().trim().min(1, "Informe o nome da data comemorativa."),
  categoria: z.enum(["nacional", "regional", "ponte"]),
});

export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaDataComemorativa.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const item = await criarDataComemorativa(parsed.data);
  return Response.json({ item }, { status: 201 });
}
