import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma corta (HMAC-SHA256, 22 caracteres base64url) para enlaces que actúan sin sesión,
 * como "desactivar esta alerta" desde el correo. Con `purpose` una firma no sirve para otra cosa.
 */
export function sign(value: string, secret: string, purpose: string): string {
  return createHmac("sha256", secret)
    .update(`${purpose}:${value}`)
    .digest("base64url")
    .slice(0, 22);
}

export function verify(value: string, token: string, secret: string, purpose: string): boolean {
  const expected = Buffer.from(sign(value, secret, purpose));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
