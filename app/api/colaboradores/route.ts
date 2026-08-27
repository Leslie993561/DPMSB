import { z } from "zod";
import { atualizarColaborador, criarColaborador, listarColaboradores } from "@/lib/db/colaboradores";
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
  nome: z.string().min(1),
  dataAdmissao: z.iso.date(),
  salarioBase: z.coerce.number().positive(),
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
  /** VT: valor de um dia útil, ida e volta. Coluna diferente da do VM. */
  valorTransporteDia: z.coerce.number().min(0).nullable().optional(),
  pis: z.string().nullable().optional(),
  cidadeNascimento: z.string().nullable().optional(),
  ufNascimento: z.string().nullable().optional(),
  nomePai: z.string().nullable().optional(),
  nomeMae: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  sexo: z.enum(["M", "F"]).nullable().optional(),
  emailPessoal: z.string().nullable().optional(),
  horario: z.string().nullable().optional(),
  banco: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  rua: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  conjugeNome: z.string().nullable().optional(),
  conjugeCpf: z.string().nullable().optional(),
  conjugeNascimento: z.iso.date().nullable().optional(),
  conjugeSexo: z.enum(["M", "F"]).nullable().optional(),
  // Sem estes quatro o zod descartava o bloco "Adicionais" em silêncio e a
  // rota devolvia 200 sem gravar nada: o formulário existia, o campo aceitava
  // o valor e nada chegava ao banco. É por isso que 74 colaboradores estavam
  // sem adicional enquanto a folha do DP pagava periculosidade.
  periculosidadePercentual: z.coerce.number().min(0).max(100).nullable().optional(),
  insalubridadePercentual: z.coerce.number().min(0).max(100).nullable().optional(),
  adicionalFixo: z.coerce.number().min(0).nullable().optional(),
  adicionalFixoDescricao: z.string().nullable().optional(),
  dependentesLista: z.array(schemaDependente).optional(),
});

export async function GET() {
  return Response.json({ colaboradores: await listarColaboradores() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }
  const { dependentesLista, ...dadosColaborador } = parsed.data;
  let colaborador = await criarColaborador(dadosColaborador);
  if (dependentesLista) {
    await substituirDependentes(colaborador.id, dependentesLista);
    colaborador = await atualizarColaborador(colaborador.id, { dependentes: dependentesLista.length });
  }
  return Response.json({ colaborador }, { status: 201 });
}
