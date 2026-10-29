import { z } from "zod";
import { ErroValidacaoFerias } from "@/lib/db/lancamentosFerias";
import { lancarFeriasPj } from "@/lib/db/feriasPj";
import { podeLancarFeriasDe } from "@/lib/acesso/equipeGestor";

export const runtime = "nodejs";

const schema = z.object({
  colaboradorId: z.coerce.number().int().positive(),
  dias: z.coerce.number(),
  dataInicioGozo: z.iso.date(),
  dataFimGozo: z.iso.date(),
  observacao: z.string().trim().nullable().optional(),
  operador: z.string().trim().min(1, "Informe o nome do operador antes de continuar."),
});

/** Lança férias de um colaborador PJ (fracionamento livre; só exige que os dias caibam no saldo). */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  if (!(await podeLancarFeriasDe(parsed.data.colaboradorId))) {
    return Response.json({ erro: "Sem permissão para lançar férias deste colaborador." }, { status: 403 });
  }

  try {
    const controle = await lancarFeriasPj({ ...parsed.data, observacao: parsed.data.observacao ?? null });
    return Response.json({ controle }, { status: 201 });
  } catch (err) {
    if (err instanceof ErroValidacaoFerias) {
      return Response.json({ erro: err.message }, { status: 400 });
    }
    throw err;
  }
}
