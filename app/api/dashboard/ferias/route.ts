import { obterDashboardFerias } from "@/lib/db/dashboardFerias";
import { escopoColaboradoresDoGestor } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anoParam = searchParams.get("ano");
  const ano = anoParam ? Number(anoParam) : undefined;
  const setor = searchParams.get("setor");
  const escopo = await escopoColaboradoresDoGestor();
  return Response.json(await obterDashboardFerias(ano && Number.isFinite(ano) ? ano : undefined, setor, escopo));
}
