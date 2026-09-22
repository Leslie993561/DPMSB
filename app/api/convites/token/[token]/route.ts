import { z } from "zod";
import { buscarColaborador, atualizarColaborador } from "@/lib/db/colaboradores";
import { substituirDependentes } from "@/lib/db/colaboradorDependentes";
import { buscarConvitePorToken, conviteValido, marcarConviteUsado } from "@/lib/db/convites";

export const runtime = "nodejs";

/**
 * Rota pública de propósito — quem preenche não tem login no portal, o token
 * na URL é a própria credencial (como um link de redefinir senha). Por isso
 * fica de fora do gate de sessão do Proxy (ver proxy.ts) e valida tudo aqui:
 * token existe, não expirou, não foi usado.
 */
async function resolverConvite(token: string) {
  const convite = await buscarConvitePorToken(token);
  if (!convite || !conviteValido(convite)) return null;
  return convite;
}

export async function GET(_request: Request, ctx: RouteContext<"/api/convites/token/[token]">) {
  const { token } = await ctx.params;
  const convite = await resolverConvite(token);
  if (!convite) return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });

  const colaborador = await buscarColaborador(convite.colaboradorId);
  if (!colaborador) return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });

  return Response.json({
    nome: colaborador.nome,
    expiraEm: convite.expiraEm,
    dados: {
      cpf: colaborador.cpf,
      pis: colaborador.pis,
      dataNascimento: colaborador.dataNascimento,
      cidadeNascimento: colaborador.cidadeNascimento,
      ufNascimento: colaborador.ufNascimento,
      nomePai: colaborador.nomePai,
      nomeMae: colaborador.nomeMae,
      telefone: colaborador.telefone,
      sexo: colaborador.sexo,
      emailPessoal: colaborador.emailPessoal,
      banco: colaborador.banco,
      agencia: colaborador.agencia,
      conta: colaborador.conta,
      cep: colaborador.cep,
      estado: colaborador.estado,
      cidade: colaborador.cidade,
      bairro: colaborador.bairro,
      rua: colaborador.rua,
      numero: colaborador.numero,
      conjugeNome: colaborador.conjugeNome,
      conjugeCpf: colaborador.conjugeCpf,
      conjugeNascimento: colaborador.conjugeNascimento,
      conjugeSexo: colaborador.conjugeSexo,
    },
  });
}

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

/**
 * Só campos PESSOAIS — de propósito não tem salário, cargo, admissão nem
 * gestor aqui: quem preenche o próprio cadastro nunca decide isso.
 */
const schema = z.object({
  cpf: z.string().nullable().optional(),
  pis: z.string().nullable().optional(),
  dataNascimento: z.iso.date().nullable().optional(),
  cidadeNascimento: z.string().nullable().optional(),
  ufNascimento: z.string().nullable().optional(),
  nomePai: z.string().nullable().optional(),
  nomeMae: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  sexo: z.enum(["M", "F"]).nullable().optional(),
  emailPessoal: z.string().nullable().optional(),
  banco: z.string().nullable().optional(),
  agencia: z.string().nullable().optional(),
  conta: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  rua: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  conjugeNome: z.string().nullable().optional(),
  conjugeCpf: z.string().nullable().optional(),
  conjugeNascimento: z.iso.date().nullable().optional(),
  conjugeSexo: z.enum(["M", "F"]).nullable().optional(),
  dependentesLista: z.array(schemaDependente).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/convites/token/[token]">) {
  const { token } = await ctx.params;
  const convite = await resolverConvite(token);
  if (!convite) return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { dependentesLista, ...dadosPessoais } = parsed.data;
  await atualizarColaborador(convite.colaboradorId, dadosPessoais);
  if (dependentesLista) {
    await substituirDependentes(convite.colaboradorId, dependentesLista);
    await atualizarColaborador(convite.colaboradorId, { dependentes: dependentesLista.length });
  }
  await marcarConviteUsado(convite.id);

  return Response.json({ ok: true });
}
