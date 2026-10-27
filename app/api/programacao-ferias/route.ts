import { listarProgramacaoFerias } from "@/lib/db/programacaoFerias";
import { escopoFeriasDoGestor } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

export async function GET() {
  const itens = await listarProgramacaoFerias();
  const escopo = await escopoFeriasDoGestor();
  return Response.json({ itens: escopo ? itens.filter((i) => escopo.has(i.colaboradorId)) : itens });
}
