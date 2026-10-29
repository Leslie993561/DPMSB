import { listarControleDeFerias } from "@/lib/db/periodosAquisitivos";
import { escopoFeriasDoGestor } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

export async function GET() {
  // `emCurso` alimenta as linhas "Em dia": períodos que ainda não fecharam,
  // portanto sem saldo exigível, mas com aquisitivo/concessivo a mostrar.
  // As duas listas saem de um carregamento só — ver listarControleDeFerias.
  const { periodos, emCurso, pj } = await listarControleDeFerias();

  // Gestor só vê férias da própria equipe e as dele mesmo, não da empresa inteira.
  const escopo = await escopoFeriasDoGestor();
  if (!escopo) return Response.json({ periodos, emCurso, pj });

  return Response.json({
    periodos: periodos.filter((p) => escopo.has(p.colaboradorId)),
    emCurso: emCurso.filter((e) => escopo.has(e.colaboradorId)),
    pj: pj.filter((e) => escopo.has(e.colaboradorId)),
  });
}
