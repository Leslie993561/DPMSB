import { listarCandidatosGestor } from "@/lib/db/acessoGestores";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ candidatos: await listarCandidatosGestor() });
}
