import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { criarFichaExame, listarFichasExameDoColaborador, obterExamesVencidosDoColaborador } from "@/lib/sst/exames";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await obterSessaoAtual();
  return sessao?.tipo === "administrador" ? sessao : null;
}

/**
 * `exame=` (repetido) manda os examesObrigatorios que o cliente já tem (vindos
 * da Matriz por Função) — evita duplicar aqui a lógica de casar cargo→função
 * só pra recalcular o que a tela já sabe.
 */
export async function GET(request: Request) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("colaboradorId"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Informe ?colaboradorId=." }, { status: 400 });
  const examesObrigatorios = url.searchParams.getAll("exame");
  const [fichas, vencidos] = await Promise.all([
    listarFichasExameDoColaborador(id),
    obterExamesVencidosDoColaborador(id, examesObrigatorios),
  ]);
  return Response.json({ fichas, vencidos });
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  colaboradorId: z.number().int().positive(),
  tipoAso: z.enum(["admissional", "periodico", "retorno", "demissional"]),
  exames: z.array(z.object({ exame: z.string().trim().min(1), dataRealizacao: dataIso })).min(1, "Selecione ao menos um exame."),
  anexoUrl: z.string().trim().min(1).nullable().optional(),
  anexoNome: z.string().trim().min(1).nullable().optional(),
});

export async function POST(request: Request) {
  const sessao = await exigirAdmin();
  if (!sessao) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const { fichaId } = await criarFichaExame(
      {
        colaboradorId: parsed.data.colaboradorId,
        tipoAso: parsed.data.tipoAso,
        exames: parsed.data.exames.map((e) => ({
          exame: e.exame,
          dataRealizacao: `${e.dataRealizacao.slice(8, 10)}/${e.dataRealizacao.slice(5, 7)}/${e.dataRealizacao.slice(0, 4)}`,
        })),
        anexoUrl: parsed.data.anexoUrl,
        anexoNome: parsed.data.anexoNome,
      },
      sessao.email,
    );
    return Response.json({ fichaId }, { status: 201 });
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao registrar o exame." }, { status: 400 });
  }
}
