import { z } from "zod";
import { obterSessaoAtual } from "@/lib/auth/sessao";
import { criarFicha, listarFichasDoColaborador } from "@/lib/sst/fichas";
import { emailConfigurado, enviarEmail } from "@/lib/email";

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

const schema = z.object({
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
    .min(1, "Selecione ao menos um EPI."),
});

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

  // A ficha já está gravada: falha no e-mail não desfaz nada, só volta o
  // motivo para o RH reenviar o link à mão.
  const destino = ficha.colaborador.email;
  let emailEnviadoPara: string | null = null;
  let erroEmail: string | null = null;
  if (!destino) {
    erroEmail = "Colaborador sem e-mail profissional no Quadro.";
  } else if (!emailConfigurado()) {
    erroEmail = "Envio automático de e-mail ainda não configurado no portal.";
  } else {
    try {
      await enviarEmail(emailFicha(destino, ficha.colaborador.nome, ficha.link));
      emailEnviadoPara = destino;
    } catch (erro) {
      erroEmail = `Não foi possível enviar o e-mail (${erro instanceof Error ? erro.message : "erro desconhecido"}).`;
    }
  }
  return Response.json({ link: ficha.link, numero: ficha.numero, emailEnviadoPara, erroEmail }, { status: 201 });
}

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailFicha(para: string, nome: string, link: string) {
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? "";
  return {
    para,
    assunto: "Ficha de entrega de EPI para assinatura",
    texto: `Olá, ${primeiroNome}!\n\nO RH registrou a entrega dos seus EPIs. Confira a ficha e assine pelo link abaixo, entrando com o seu e-mail profissional:\n${link}\n\nO link vale por 7 dias.\n\nRH · MSB`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2d3d;max-width:520px">
  <p>Olá, ${escaparHtml(primeiroNome)}!</p>
  <p>O RH registrou a entrega dos seus EPIs. Confira a ficha e assine pelo botão abaixo, entrando com o seu e-mail profissional.</p>
  <p style="margin:24px 0"><a href="${escaparHtml(link)}" style="background:#4a9fb5;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Conferir e assinar a ficha</a></p>
  <p style="font-size:12px;color:#6b7c8f">O link vale por 7 dias. Se o botão não abrir, copie este endereço no navegador:<br>${escaparHtml(link)}</p>
  <p>RH · MSB</p>
</div>`,
  };
}
