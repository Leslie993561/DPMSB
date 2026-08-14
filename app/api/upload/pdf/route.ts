import { parsearHoleritePdf } from "@/lib/parsing/pdf";

export const runtime = "nodejs";

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return Response.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ erro: "Envie um arquivo .pdf." }, { status: 400 });
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    return Response.json({ erro: "Arquivo maior que 10 MB." }, { status: 400 });
  }

  try {
    const resultado = await parsearHoleritePdf(await arquivo.arrayBuffer());
    return Response.json(resultado);
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Não foi possível ler o PDF.";
    return Response.json({ erro: mensagem }, { status: 400 });
  }
}
