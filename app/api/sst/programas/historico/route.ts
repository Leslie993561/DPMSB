import { obterSessaoAtual } from "@/lib/auth/sessao";
import { listarHistoricoPrograma } from "@/lib/sst/programas";
import { PROGRAMAS_SAUDE } from "@/lib/sst/domain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const programa = searchParams.get("programa");
  if (!PROGRAMAS_SAUDE.includes(programa as (typeof PROGRAMAS_SAUDE)[number])) {
    return Response.json({ erro: "Programa inválido." }, { status: 400 });
  }

  const versoes = await listarHistoricoPrograma(programa as (typeof PROGRAMAS_SAUDE)[number]);
  return Response.json({ versoes });
}
