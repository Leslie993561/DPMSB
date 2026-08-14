import { listarPeriodosAbertos } from "@/lib/db/periodosAquisitivos";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ periodos: listarPeriodosAbertos() });
}
