import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { criarFicha, listarFichasDoColaborador } from "@/lib/sst/fichas";

export const runtime = "nodejs";

// SST é só do RH: proxy.ts barra as páginas /sst, mas /api/sst passa por ele
// como API comum — por isso a checagem de administrador fica aqui.
async function exigirAdmin() {
  const sessao = await obterSessaoAtual();
  return sessao?.tipo === "administrador" ? sessao : null;
}

export async function GET(request: Request) {
  if (!(await exigirAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("colaboradorId"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ erro: "Informe ?colaboradorId=." }, { status: 400 });
  return Response.json(await listarFichasDoColaborador(id, url.origin));
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z
  .object({
    colaboradorId: z.number().int().positive(),
    itens: z
      .array(
        z.object({
          epi: z.string().trim().min(1),
          qtd: z.number().int().min(1).default(1),
          ca: z.string().trim().default(""),
          dataEntrega: dataIso,
          dataTroca: dataIso.nullable(),
        }),
      )
      .default([]),
    fardamento: z
      .array(z.object({ tipo: z.string().trim().min(1), qtd: z.number().int().min(1).default(1), dataEntrega: dataIso }))
      .default([]),
    anexoUrl: z.string().trim().min(1).nullable().optional(),
    anexoNome: z.string().trim().min(1).nullable().optional(),
  })
  .refine((d) => d.itens.length + d.fardamento.length > 0, { message: "Selecione ao menos um EPI ou fardamento." });

export async function POST(request: Request) {
  const sessao = await exigirAdmin();
  if (!sessao) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ erro: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  let ficha;
  try {
    ficha = await criarFicha(parsed.data, sessao.email, new URL(request.url).origin);
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Falha ao gerar a ficha." }, { status: 400 });
  }

  // O e-mail não sai mais daqui — só quando o RH clica em "Concluir" na tela
  // (POST /api/sst/epi/fichas/[id]/enviar-email), depois de conferir o link.
  return Response.json({ fichaId: ficha.fichaId, link: ficha.link, numero: ficha.numero }, { status: 201 });
}
