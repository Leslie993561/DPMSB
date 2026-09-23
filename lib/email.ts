import "server-only";
import nodemailer from "nodemailer";

/**
 * Envio de e-mail por SMTP — serve para a conta de e-mail da empresa
 * (Microsoft 365: smtp.office365.com:587) ou para um serviço de envio.
 * Sem SMTP_HOST/SMTP_USER/SMTP_PASS o portal segue funcionando, só não envia:
 * quem chama recebe `false` e mostra o link para enviar à mão.
 */
export function emailConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function enviarEmail(msg: { para: string; assunto: string; html: string; texto: string }): Promise<void> {
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
