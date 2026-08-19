import { listarLancamentosAtivosComContexto } from "@/lib/db/lancamentosFerias";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ lancamentos: await listarLancamentosAtivosComContexto() });
}
