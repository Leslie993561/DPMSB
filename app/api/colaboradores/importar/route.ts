import { z } from "zod";
import { parsearPlanilha } from "@/lib/parsing/spreadsheet";
import { converterParaColaboradoresCadastro, sugerirMapeamentoColaborador } from "@/lib/parsing/mappers";
import { importarColaboradores, type Vinculo } from "@/lib/db/colaboradores";

export const runtime = "nodejs";

const EXTENSOES = [".xlsx", ".xls", ".csv"];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const schemaConfirmacao = z.object({
  linhas: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  mapeamento: z.object({
    nome: z.string().nullable().optional(),
    dataAdmissao: z.string(),
    dataNascimento: z.string().nullable().optional(),
    salarioBase: z.string(),
    dependentes: z.string().nullable().optional(),
    cpf: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    cargo: z.string().nullable().optional(),
    departamento: z.string().nullable().optional(),
    vinculo: z.string().nullable().optional(),
    liderDireto: z.string().nullable().optional(),
    alimentacaoValor: z.string().nullable().optional(),
    cbo: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    agencia: z.string().nullable().optional(),
    conta: z.string().nullable().optional(),
    pis: z.string().nullable().optional(),
    cidadeNascimento: z.string().nullable().optional(),
    ufNascimento: z.string().nullable().optional(),
    nomePai: z.string().nullable().optional(),
    nomeMae: z.string().nullable().optional(),
    telefone: z.string().nullable().optional(),
    sexo: z.string().nullable().optional(),
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
    conjugeNascimento: z.string().nullable().optional(),
  }),
});

/**
 * Duas formas de uso:
 * - multipart/form-data com `arquivo`: faz o parse e devolve cabeçalhos +
 *   sugestões de mapeamento (primeiro passo, sem gravar nada).
 * - application/json com `linhas` + `mapeamento` (já confirmado pelo
 *   usuário): grava o lote no cadastro (segundo passo).
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!EXTENSOES.some((ext) => arquivo.name.toLowerCase().endsWith(ext))) {
      return Response.json(
        { erro: `Formato não suportado. Envie um arquivo ${EXTENSOES.join(", ")}.` },
        { status: 400 },
      );
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return Response.json({ erro: "Arquivo maior que 5 MB." }, { status: 400 });
    }

    try {
      const { cabecalhos, linhas } = await parsearPlanilha(await arquivo.arrayBuffer(), arquivo.name);
      return Response.json({
        cabecalhos,
        linhas,
        sugestoes: sugerirMapeamentoColaborador(cabecalhos),
        totalLinhas: linhas.length,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Não foi possível ler a planilha.";
      return Response.json({ erro: mensagem }, { status: 400 });
    }
  }

  const body = await request.json();
  const parsed = schemaConfirmacao.safeParse(body);
  if (!parsed.success) {
    return Response.json({ erro: "Dados inválidos", detalhes: parsed.error.issues }, { status: 400 });
  }

  let conversao;
  try {
    conversao = converterParaColaboradoresCadastro(parsed.data.linhas, parsed.data.mapeamento);
  } catch (err) {
    return Response.json(
      { erro: err instanceof Error ? err.message : "Erro ao mapear as colunas." },
      { status: 400 },
    );
  }

  const resultado = await importarColaboradores(
    conversao.colaboradores.map((c) => ({ ...c, vinculo: c.vinculo as Vinculo | null })),
  );
  return Response.json({
    criados: resultado.criados,
    atualizados: resultado.atualizados,
    parecidos: resultado.parecidos,
    descartadas: conversao.descartadas,
  });
}
