import { listarControleDeFerias } from "@/lib/db/periodosAquisitivos";
import { escopoColaboradoresDoGestor } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

export async function GET() {
  // `emCurso` alimenta as linhas "Em dia": períodos que ainda não fecharam,
  // portanto sem saldo exigível, mas com aquisitivo/concessivo a mostrar.
  // As duas listas saem de um carregamento só — ver listarControleDeFerias.
  const { periodos, emCurso } = await listarControleDeFerias();

  // Gestor só vê férias da própria equipe, não da empresa inteira.
  const escopo = await escopoColaboradoresDoGestor();
  if (!escopo) return Response.json({ periodos, emCurso });

  return Response.json({
    periodos: periodos.filter((p) => escopo.has(p.colaboradorId)),
    emCurso: emCurso.filter((e) => escopo.has(e.colaboradorId)),
  });
}
