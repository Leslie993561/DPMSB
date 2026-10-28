import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { editaColaboradores } from "@/lib/auth/perfil";
import { reabrirCompetencia } from "@/lib/db/folhaBreakdown";

export const runtime = "nodejs";

const schema = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/) });

/**
 * Reabre um mês fechado. Descarta o retrato congelado — a competência volta a
 * ser recalculada com o cadastro atual. As verbas extras importadas não são
 * tocadas: elas valem com o mês aberto ou fechado.
 *
 * Gestor liberado pro Breakdown só vê — fechar/reabrir competência é do RH.
 */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!editaColaboradores(sessao)) {
    return Response.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Informe competencia no formato AAAA-MM." }, { status: 400 });
  }

  // O mês fechado não é mais reaberto pelo portal: descartar o retrato congelado
  // perdia os valores sem volta. Só uma nova planilha altera o que foi fechado.
  void reabrirCompetencia;
  return Response.json({ erro: "Mês fechado não é reaberto: só uma nova planilha altera os valores." }, { status: 409 });
}
