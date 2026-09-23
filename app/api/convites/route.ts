import { z } from "zod";
import { buscarColaborador } from "@/lib/db/colaboradores";
import { criarConvite } from "@/lib/db/convites";
import { obterSessaoAtual } from "@/lib/auth/sessao";

export const runtime = "nodejs";

const schema = z.object({
  // Ausente/null = pré-cadastro: ainda não existe colaborador, a própria pessoa cria o registro ao preencher o link.
  colaboradorId: z.number().int().positive().nullable().optional(),
  email: z.string().email("Informe um e-mail válido."),
});

/** Só o administrador manda convite — quem decide quem entra é sempre uma pessoa, não um gestor de equipe. */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") {
    return Response.json({ erro: "Só o administrador pode enviar link de cadastro." }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  let colaboradorId: number | null = null;
  if (parsed.data.colaboradorId != null) {
    const colaborador = await buscarColaborador(parsed.data.colaboradorId);
    if (!colaborador) {
      return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
    }
    colaboradorId = colaborador.id;
  }

  const convite = await criarConvite(colaboradorId, parsed.data.email);
  const url = new URL(request.url);
  const link = `${url.protocol}//${url.host}/convite/${convite.token}`;

  return Response.json({ link, expiraEm: convite.expiraEm }, { status: 201 });
}
