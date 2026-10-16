import { obterSessaoAtual } from "@/lib/auth/sessao";
import { editaColaboradores } from "@/lib/auth/perfil";
import { SETORES } from "@/lib/setores";
import { adicionarSetorExtra, listarSetoresExtras } from "@/lib/db/setoresExtras";

export const runtime = "nodejs";

/** Setores adicionados pelo RH (além da lista fixa). */
export async function GET() {
  return Response.json({ extras: await listarSetoresExtras() });
}

export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || !editaColaboradores(sessao)) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const corpo = (await request.json().catch(() => ({}))) as { nome?: unknown };
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim().replace(/\s+/g, " ") : "";
  if (nome.length < 2 || nome.length > 60) return Response.json({ erro: "Informe o nome do setor (2 a 60 letras)." }, { status: 400 });

  const existentes = [...SETORES, ...(await listarSetoresExtras())];
  const igual = existentes.find((s) => s.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
  if (igual) return Response.json({ erro: `O setor "${igual}" já existe.` }, { status: 409 });

  await adicionarSetorExtra(nome);
  return Response.json({ nome }, { status: 201 });
}
