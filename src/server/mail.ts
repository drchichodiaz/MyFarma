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

export type AlertEmail = {
  to: string;
  medName: string;
  branchLabel: string;
  statusLabel: string;
  price: string | null;
  distance: string;
  placeLabel: string;
  url: string;
  directionsUrl: string;
  offUrl: string;
  /** POST de un clic (RFC 8058) para el botón "Cancelar suscripción" de Gmail. */
  oneClickUrl: string;
};

/** Correo de alerta: "Hay X en tal sucursal, a N km de tu zona". */
export async function sendAlertEmail(a: AlertEmail) {
  const e = escape;
  await mailer.sendMail({
    from: env.EMAIL_FROM,
    to: a.to,
    subject: `${a.statusLabel}: ${a.medName} en ${a.branchLabel}`,
    headers: {
      "List-Unsubscribe": `<${a.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: [
      `${a.statusLabel}: ${a.medName}`,
      `${a.branchLabel} · a ${a.distance} de ${a.placeLabel}${a.price ? ` · ${a.price}` : ""}`,
      "",
      `Ver detalle: ${a.url}`,
      `Cómo llegar: ${a.directionsUrl}`,
      "",
      "Lo reportó otro paciente. Llama antes de ir si puedes.",
      `Desactivar esta alerta: ${a.offUrl}`,
    ].join("\n"),
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f0f3f6;font-family:Arial,Helvetica,sans-serif;color:#161e42">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;padding:28px">
<tr><td style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#168c3e">${e(a.statusLabel)} cerca de ti</td></tr>
<tr><td style="padding-top:6px;font-size:26px;font-weight:900;letter-spacing:-.02em">${e(a.medName)}</td></tr>
<tr><td style="padding-top:10px;font-size:16px;line-height:1.5"><b>${e(a.branchLabel)}</b><br>a ${e(a.distance)} de ${e(a.placeLabel)}${a.price ? ` · <span style="font-family:monospace">${e(a.price)}</span>` : ""}</td></tr>
<tr><td style="padding:22px 0 8px"><a href="${e(a.url)}" style="display:inline-block;background:#0e4f20;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:999px">Ver detalle</a>
&nbsp;<a href="${e(a.directionsUrl)}" style="display:inline-block;color:#0e4f20;text-decoration:none;font-weight:700;font-size:15px;padding:13px 12px">Cómo llegar →</a></td></tr>
<tr><td style="padding-top:12px;font-size:13px;line-height:1.5;color:#626a84">Lo reportó otro paciente. Si puedes, llama antes de ir. Te avisamos como máximo una vez cada 12 horas por alerta.</td></tr>
<tr><td style="padding-top:16px;font-size:12px;color:#626a84"><a href="${e(a.offUrl)}" style="color:#626a84">Desactivar esta alerta</a></td></tr>
</table></td></tr></table></body></html>`,
  });
}
