import { obterSessaoAtual } from "@/lib/auth/sessao";
import { buscarChecklist, listarTiposAnexados, salvarChecklist } from "@/lib/db/colaboradorChecklist";
import { buscarColaborador } from "@/lib/db/colaboradores";
import { chavesMarcaveis, SECOES_CHECKLIST } from "@/lib/checklistAdmissional";

export const runtime = "nodejs";

const CHAVES_VALIDAS = new Set([
  ...chavesMarcaveis(),
  ...SECOES_CHECKLIST.flatMap((s) => s.blocos.flatMap((b) => b.itens.flatMap((i) => (i.campos ?? []).map((c) => c.chave)))),
]);

async function validar(params: Promise<{ id: string }>) {
  if ((await obterSessaoAtual())?.tipo !== "administrador") {
    return { erro: Response.json({ erro: "Sem permissão." }, { status: 403 }) };
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return { erro: Response.json({ erro: "Colaborador inválido." }, { status: 400 }) };
  return { id };
}

/** Check list do processo admissional do colaborador. Admin-only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await validar(params);
  if (v.erro) return v.erro;
  const [dados, anexados] = await Promise.all([buscarChecklist(v.id), listarTiposAnexados(v.id)]);
  return Response.json({ dados, anexados });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await validar(params);
  if (v.erro) return v.erro;
  if (!(await buscarColaborador(v.id))) return Response.json({ erro: "Colaborador não encontrado." }, { status: 404 });

  const corpo = (await request.json().catch(() => null)) as { dados?: Record<string, unknown> } | null;
  if (!corpo?.dados || typeof corpo.dados !== "object") return Response.json({ erro: "Dados inválidos." }, { status: 400 });

  const limpo: Record<string, boolean | string> = {};
  for (const [chave, valor] of Object.entries(corpo.dados)) {
    if (!CHAVES_VALIDAS.has(chave)) continue;
    if (valor === true) limpo[chave] = true;
    else if (typeof valor === "string" && valor.trim() !== "") limpo[chave] = valor.slice(0, 100);
  }
  await salvarChecklist(v.id, limpo);
  return Response.json({ dados: limpo });
}
