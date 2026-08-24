import { listarControleDeFerias } from "@/lib/db/periodosAquisitivos";

export const runtime = "nodejs";

export async function GET() {
  // `emCurso` alimenta as linhas "Em dia": períodos que ainda não fecharam,
  // portanto sem saldo exigível, mas com aquisitivo/concessivo a mostrar.
  // As duas listas saem de um carregamento só — ver listarControleDeFerias.
  return Response.json(await listarControleDeFerias());
}
