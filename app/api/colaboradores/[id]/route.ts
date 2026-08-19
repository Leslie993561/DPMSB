import { z } from "zod";
import { atualizarColaborador, buscarColaborador } from "@/lib/db/colaboradores";
import { substituirDependentes } from "@/lib/db/colaboradorDependentes";

export const runtime = "nodejs";

const schemaDependente = z.object({
  nome: z.string().min(1),
  cpf: z.string().nullable().optional(),
  sexo: z.enum(["M", "F"]).nullable().optional(),
  dataNascimento: z.iso.date().nullable().optional(),
  certidaoLivro: z.string().nullable().optional(),
  certidaoFolha: z.string().nullable().optional(),
  certidaoMatricula: z.string().nullable().optional(),
  certidaoDataEmissao: z.iso.date().nullable().optional(),
});

const schema = z.object({
  nome: z.string().min(1).optional(),
  dataAdmissao: z.iso.date().optional(),
  salarioBase: z.coerce.number().positive().optional(),
  dependentes: z.coerce.number().min(0).optional(),
  cpf: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  departamento: z.string().nullable().optional(),
  gestorId: z.coerce.number().int().positive().nullable().optional(),
  cidade: z.string().nullable().optional(),
  vinculo: z.enum(["CLT", "CLT-bio", "PJ", "EST", "JÁ"]).nullable().optional(),
  alimentacaoValor: z.coerce.number().min(0).nullable().optional(),
  dataNascimento: z.iso.date().nullable().optional(),
  cbo: z.string().nullable().optional(),
  agencia: z.string().nullable().optional(),
  conta: z.string().nullable().optional(),
  tipoTransporte: z.enum(["vt_diario", "vm_fixo"]).optional(),
  valorTransporteFixo: z.coerce.number().min(0).nullable().optional(),
  status: z.enum(["ativo", "desligado"]).optional(),
  dataDesligamento: z.iso.date().nullable().optional(),
  motivoDesligamento: z.string().nullable().optional(),
  valorRescisao: z.coerce.number().min(0).nullable().optional(),
  dependentesLista: z.array(schemaDependente).optional(),
});

export async function GET(_request: Request, ctx: RouteContext<"/api/colaboradores/[id]">) {
  const { id } = await ctx.params;
  const colaborador = await buscarColaborador(Number(id));
  if (!colaborador) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });
  return Response.json({ colaborador });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/colaboradores/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const existente = await buscarColaborador(Number(id));
  if (!existente) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  const { dependentesLista, ...dadosColaborador } = parsed.data;
  let colaborador = await atualizarColaborador(Number(id), dadosColaborador);
  if (dependentesLista) {
    await substituirDependentes(colaborador.id, dependentesLista);
    colaborador = await atualizarColaborador(colaborador.id, { dependentes: dependentesLista.length });
  }
  return Response.json({ colaborador });
}
