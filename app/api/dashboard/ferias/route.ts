import { obterDashboardFerias } from "@/lib/db/dashboardFerias";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anoParam = searchParams.get("ano");
  const ano = anoParam ? Number(anoParam) : undefined;
  const setor = searchParams.get("setor");
  return Response.json(await obterDashboardFerias(ano && Number.isFinite(ano) ? ano : undefined, setor));
}
