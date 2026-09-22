import { listarDependentes } from "@/lib/db/colaboradorDependentes";
import { dentroDoEscopo } from "@/lib/acesso/equipeGestor";
import { obterSessaoAtual } from "@/lib/auth/sessao";

export const runtime = "nodejs";

/** Dependente é dado pessoal (LGPD) — só RH, nunca gestor, mesmo de quem ele lidera. */
export async function GET(_request: Request, ctx: RouteContext<"/api/colaboradores/[id]/dependentes">) {
  const sessao = await obterSessaoAtual();
  if (sessao?.tipo !== "administrador") {
    return Response.json({ erro: "Só o RH vê dependentes." }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await dentroDoEscopo(Number(id)))) {
    return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
  }
  return Response.json({ dependentes: await listarDependentes(Number(id)) });
}
