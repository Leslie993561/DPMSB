import { z } from "zod";
import { buscarColaborador, atualizarColaborador, criarColaborador } from "@/lib/db/colaboradores";
import { substituirDependentes } from "@/lib/db/colaboradorDependentes";
import {
  buscarConvitePorToken,
  convitePodeAbrir,
  convitePodeSubmeter,
  marcarConviteAberto,
  marcarConviteUsado,
  vincularConviteAoColaborador,
} from "@/lib/db/convites";

export const runtime = "nodejs";

const ERRO_INVALIDO = { erro: "Link inválido, expirado ou já usado." };

/** Formulário em branco para o convite de pré-cadastro (colaborador ainda não existe). */
const DADOS_VAZIOS = {
  cpf: null,
  pis: null,
  dataNascimento: null,
  cidadeNascimento: null,
  ufNascimento: null,
  nomePai: null,
  nomeMae: null,
  telefone: null,
  sexo: null,
  emailPessoal: null,
  banco: null,
  agencia: null,
  conta: null,
  cep: null,
  estado: null,
  cidade: null,
  bairro: null,
  rua: null,
  numero: null,
  conjugeNome: null,
  conjugeCpf: null,
  conjugeNascimento: null,
  conjugeSexo: null,
  tituloEleitor: null,
  tituloEleitorZona: null,
  tituloEleitorSecao: null,
  tituloEleitorEmissao: null,
  cnhCategoria: null,
  cnhValidade: null,
  cnhEmissao: null,
  reservistaSerie: null,
  tamanhoCamisa: null,
  tamanhoCalca: null,
  tamanhoSapato: null,
};

/**
 * Rota pública de propósito — quem preenche não tem login no portal, o token
 * na URL é a própria credencial (como um link de redefinir senha). Por isso
 * fica de fora do gate de sessão do Proxy (ver proxy.ts).
 *
 * GET só é permitido a primeira vez (marca `aberto_em` na hora): recarregar a
 * página ou reabrir o mesmo link depois já retorna inválido — é o que trava
 * "só pode ser aberto uma vez, na segunda não permite".
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/convites/token/[token]">) {
  const { token } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeAbrir(convite)) {
    return Response.json(ERRO_INVALIDO, { status: 404 });
  }

  // Pré-cadastro: ainda não existe colaborador — devolve um formulário em branco (a pessoa preenche tudo, inclusive o nome).
  if (convite.colaboradorId === null) {
    await marcarConviteAberto(convite.id);
    return Response.json({ nome: "", novo: true, expiraEm: convite.expiraEm, dados: DADOS_VAZIOS });
  }

  const colaborador = await buscarColaborador(convite.colaboradorId);
  if (!colaborador) return Response.json(ERRO_INVALIDO, { status: 404 });

  await marcarConviteAberto(convite.id);

  return Response.json({
    nome: colaborador.nome,
    novo: false,
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
      tituloEleitor: colaborador.tituloEleitor,
      tituloEleitorZona: colaborador.tituloEleitorZona,
      tituloEleitorSecao: colaborador.tituloEleitorSecao,
      tituloEleitorEmissao: colaborador.tituloEleitorEmissao,
      cnhCategoria: colaborador.cnhCategoria,
      cnhValidade: colaborador.cnhValidade,
      cnhEmissao: colaborador.cnhEmissao,
      reservistaSerie: colaborador.reservistaSerie,
      tamanhoCamisa: colaborador.tamanhoCamisa,
      tamanhoCalca: colaborador.tamanhoCalca,
      tamanhoSapato: colaborador.tamanhoSapato,
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
  // Só obrigatório (e só usado) quando o convite é de pré-cadastro (colaboradorId null).
  nome: z.string().trim().min(1).optional(),
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
  tituloEleitor: z.string().nullable().optional(),
  tituloEleitorZona: z.string().nullable().optional(),
  tituloEleitorSecao: z.string().nullable().optional(),
  tituloEleitorEmissao: z.iso.date().nullable().optional(),
  cnhCategoria: z.string().nullable().optional(),
  cnhValidade: z.iso.date().nullable().optional(),
  cnhEmissao: z.iso.date().nullable().optional(),
  reservistaSerie: z.string().nullable().optional(),
  tamanhoCamisa: z.string().nullable().optional(),
  tamanhoCalca: z.string().nullable().optional(),
  tamanhoSapato: z.string().nullable().optional(),
  dependentesLista: z.array(schemaDependente).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/convites/token/[token]">) {
  const { token } = await ctx.params;
  const convite = await buscarConvitePorToken(token);
  if (!convite || !convitePodeSubmeter(convite)) {
    return Response.json(ERRO_INVALIDO, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  const { dependentesLista, nome, ...dadosPessoais } = parsed.data;

  let colaboradorId = convite.colaboradorId;
  if (colaboradorId === null) {
    // Pré-cadastro: ninguém existia ainda — cria o colaborador com o que a
    // própria pessoa preencheu. Cargo, salário, admissão e gestor ficam de
    // fora de propósito (mesma regra do resto deste arquivo): quem se
    // autocadastra nunca decide isso, o RH completa depois no Quadro.
    if (!nome) {
      return Response.json({ erro: "Informe seu nome completo." }, { status: 400 });
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const novo = await criarColaborador({
      nome,
      dataAdmissao: hoje,
      salarioBase: 0,
      emailPessoal: dadosPessoais.emailPessoal ?? convite.email,
      ...dadosPessoais,
    });
    colaboradorId = novo.id;
    await vincularConviteAoColaborador(convite.id, novo.id);
  } else {
    await atualizarColaborador(colaboradorId, dadosPessoais);
  }

  if (dependentesLista) {
    await substituirDependentes(colaboradorId, dependentesLista);
    await atualizarColaborador(colaboradorId, { dependentes: dependentesLista.length });
  }
  await marcarConviteUsado(convite.id);

  return Response.json({ ok: true });
}
