import { baixarArquivoPrivado } from "@/lib/blob";
import { obterFichaPublica } from "@/lib/sst/fichas";

export const runtime = "nodejs";

// Pública de propósito (mesmo motivo de app/api/assinatura-epi/[token]/route.ts):
// o colaborador baixa o anexo antes/depois de assinar sem precisar de login,
// com o próprio token do link como credencial.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const documento = await obterFichaPublica((await params).token);
  if (!documento?.anexoUrl) return Response.json({ erro: "Sem anexo para esta ficha." }, { status: 404 });

  const resposta = await baixarArquivoPrivado(documento.anexoUrl);
  if (!resposta.ok || !resposta.body) return Response.json({ erro: "Não foi possível carregar o anexo." }, { status: 502 });

  return new Response(resposta.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(documento.anexoNome ?? "anexo.pdf").replace(/"/g, "")}"`,
    },
  });
}
