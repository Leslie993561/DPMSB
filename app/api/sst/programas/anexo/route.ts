import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { blobConfigurado, criarUrlUploadDireto } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({ nomeOriginal: z.string().min(1) });

/**
 * Não recebe o PDF aqui — devolve uma URL assinada pro navegador subir o
 * arquivo direto no Supabase Storage. Ver criarUrlUploadDireto (lib/storage.ts)
 * sobre o porquê: a Vercel recusa corpo de requisição grande antes de chegar
 * numa rota comum.
 */
export async function POST(request: Request) {
  const sessao = await obterSessaoAtual();
  if (!sessao || sessao.tipo !== "administrador") return Response.json({ erro: "Sem permissão." }, { status: 403 });

  if (!blobConfigurado()) {
    return Response.json({ erro: "Armazenamento de arquivos ainda não configurado no portal." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ erro: "Informe o nome do arquivo." }, { status: 400 });

  const upload = await criarUrlUploadDireto("sst/programas-saude", parsed.data.nomeOriginal);
  return Response.json(upload, { status: 201 });
}
