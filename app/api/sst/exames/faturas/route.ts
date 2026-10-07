import { carregarPdfParse } from "@/lib/parsing/carregarPdfParse";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { interpretarFaturaExames } from "@/lib/sst/faturaExames";
import { listarFaturasExame, salvarFaturaExame } from "@/lib/sst/faturasExame";

export const runtime = "nodejs";

const TAMANHO_MAX = 10 * 1024 * 1024;

async function soAdmin() {
  const sessao = await obterSessaoAtual();
  return sessao?.tipo === "administrador";
}

export async function GET() {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });
  return Response.json({ faturas: await listarFaturasExame() });
}

/** Recebe o PDF da fatura mensal, lê e grava (reimportar o mesmo mês substitui). */
export async function POST(request: Request) {
  if (!(await soAdmin())) return Response.json({ erro: "Sem permissão." }, { status: 403 });

  const form = await request.formData();
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie o PDF da fatura." }, { status: 400 });
  if (arquivo.type !== "application/pdf") return Response.json({ erro: "Só é permitido PDF." }, { status: 400 });
  if (arquivo.size > TAMANHO_MAX) return Response.json({ erro: "O PDF não pode passar de 10MB." }, { status: 400 });

  try {
    const { PDFParse } = await carregarPdfParse();
    const texto = (await new PDFParse({ data: new Uint8Array(await arquivo.arrayBuffer()) }).getText()).text;
    const fatura = interpretarFaturaExames(texto);
    const soma = Math.round(fatura.asos.reduce((s, a) => s + a.valor, 0) * 100) / 100;
    const { substituiu } = await salvarFaturaExame(fatura, arquivo.name);
    return Response.json(
      { fechamento: fatura.fechamento, total: fatura.total, asos: fatura.asos.length, substituiu, divergeDaSoma: Math.abs(soma - fatura.total) > 0.01 },
      { status: 201 },
    );
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "Não consegui ler a fatura." }, { status: 422 });
  }
}
