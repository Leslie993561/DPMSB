import { listarProgramacaoFerias } from "@/lib/db/programacaoFerias";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ itens: await listarProgramacaoFerias() });
}
