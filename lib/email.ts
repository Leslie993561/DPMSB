import "server-only";
import nodemailer from "nodemailer";

/**
 * Envio de e-mail. Dois caminhos, o primeiro que estiver configurado:
 *
 * 1. Microsoft Graph (Microsoft 365) — GRAPH_TENANT_ID, GRAPH_CLIENT_ID,
 *    GRAPH_CLIENT_SECRET e EMAIL_REMETENTE. É o caminho para o @msbbrasil.com:
 *    o Exchange Online não aceita mais SMTP com usuário e senha.
 * 2. SMTP genérico — SMTP_HOST, SMTP_USER, SMTP_PASS (outros provedores).
 *
 * Sem nenhum dos dois o portal segue funcionando, só não envia: quem chama
 * recebe o aviso e mostra o link para enviar à mão.
 */
function graphConfigurado(): boolean {
  return Boolean(
    process.env.GRAPH_TENANT_ID &&
      process.env.GRAPH_CLIENT_ID &&
      process.env.GRAPH_CLIENT_SECRET &&
      process.env.EMAIL_REMETENTE,
  );
}

function smtpConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfigurado(): boolean {
  return graphConfigurado() || smtpConfigurado();
}

interface Mensagem {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

async function enviarPorGraph(msg: Mensagem): Promise<void> {
  const tenant = process.env.GRAPH_TENANT_ID!;
  const remetente = process.env.EMAIL_REMETENTE!;

  const respostaToken = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GRAPH_CLIENT_ID!,
      client_secret: process.env.GRAPH_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const token = (await respostaToken.json()) as { access_token?: string; error_description?: string };
  if (!respostaToken.ok || !token.access_token) {
    throw new Error(`Microsoft recusou a autorização: ${token.error_description?.split("\r\n")[0] ?? respostaToken.status}`);
  }

  const envio = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(remetente)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: msg.assunto,
        body: { contentType: "HTML", content: msg.html },
        toRecipients: [{ emailAddress: { address: msg.para } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!envio.ok) {
    const detalhe = (await envio.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Microsoft recusou o envio: ${detalhe?.error?.message ?? envio.status}`);
  }
}

async function enviarPorSmtp(msg: Mensagem): Promise<void> {
  const porta = Number(process.env.SMTP_PORT ?? 587);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporte.sendMail({
    from: process.env.EMAIL_REMETENTE ?? `RH · MSB <${process.env.SMTP_USER}>`,
    to: msg.para,
    subject: msg.assunto,
    html: msg.html,
    text: msg.texto,
  });
}

export async function enviarEmail(msg: Mensagem): Promise<void> {
  if (graphConfigurado()) return enviarPorGraph(msg);
  return enviarPorSmtp(msg);
}
