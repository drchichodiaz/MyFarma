import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";

/**
 * Transporte SMTP: Mailpit en desarrollo, Resend en producción.
 * En producción va por el puerto 2465 (TLS directo), porque DigitalOcean bloquea 25/465/587.
 * Los timeouts evitan que un SMTP lento cuelgue la petición.
 */
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465 || env.SMTP_PORT === 2465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  connectionTimeout: 5_000,
  greetingTimeout: 5_000,
  socketTimeout: 10_000,
});

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Correo del enlace mágico para entrar. */
export async function sendSignInLink(to: string, url: string) {
  const host = new URL(url).host;
  const link = escape(url);
  await mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject: "Tu enlace para entrar a MyFarma",
    text: `Entra a MyFarma con este enlace (vale por 24 horas):\n\n${url}\n\nSi no lo pediste, ignora este correo.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f0f3f6;font-family:Arial,Helvetica,sans-serif;color:#161e42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;padding:32px">
<tr><td style="font-size:24px;font-weight:900;letter-spacing:-.02em">MyFarma</td></tr>
<tr><td style="padding-top:16px;font-size:16px;line-height:1.5">Toca el botón para entrar. El enlace vale por 24 horas y sirve una sola vez.</td></tr>
<tr><td style="padding:24px 0"><a href="${link}" style="display:inline-block;background:#0e4f20;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">Entrar a MyFarma</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#626a84">Si no pediste entrar a ${escape(host)}, ignora este correo: nadie puede entrar sin este enlace.</td></tr>
</table></td></tr></table></body></html>`,
  });
}
