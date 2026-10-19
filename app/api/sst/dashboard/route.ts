import { obterSessaoAtual } from "@/lib/auth/sessao";
import { acessaSst } from "@/lib/auth/perfil";
import { obterDashboardSst } from "@/lib/sst/dashboard";

export const runtime = "nodejs";

/** Recorte leve do Dashboard SST para o cartão de resumo da home — evita levar pendências/desligamentos, que ali não aparecem. */
export async function GET() {
  const sessao = await obterSessaoAtual();
  if (!acessaSst(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const dados = await obterDashboardSst();
  return Response.json({
    kpi: dados.kpi,
    pctEmDia: dados.pctEmDia,
    fichasEpi: dados.fichasEpi,
    custoMensalEpiExames: dados.custoMensalEpiExames,
  });
}
