import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarProgramasSaude, registrarVersaoPrograma } from "@/lib/sst/programas";
import { PROGRAMAS_SAUDE } from "@/lib/sst/domain";

export const runtime = "nodejs";

export async function GET() {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const programas = await listarProgramasSaude();
  return Response.json({ programas });
}

const schemaPost = z.object({
  programa: z.enum(PROGRAMAS_SAUDE),
  vigenciaInicio: z.string().min(1, "Informe a data de início."),
  vigenciaFim: z.string().min(1, "Informe o vencimento."),
  precisaoFim: z.enum(["dia", "mes"]),
  autor: z.string().trim().min(1, "Informe o autor/responsável técnico."),
  anexoUrl: z.string().optional().nullable(),
  anexoNome: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schemaPost.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { id } = await registrarVersaoPrograma(parsed.data);
  return Response.json({ id }, { status: 201 });
}
