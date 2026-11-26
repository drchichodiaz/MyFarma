import "server-only";
import { env } from "@/lib/env";
import { sign, verify } from "@/lib/signed";

/**
 * Lo que comparten la app y el worker sobre alertas, sin depender de Next
 * (la imagen del worker no trae Next).
 */
export const ALERT_LIMITS = {
  perUser: 10,
  minKm: 1,
  maxKm: 10,
  /** Máximo un aviso por alerta en este lapso. */
  throttleHours: 12,
} as const;

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

// Enlaces de baja del correo, firmados con AUTH_SECRET.
const PURPOSE = "alert-off";
function secret() {
  if (!env.AUTH_SECRET) throw new Error("Falta AUTH_SECRET para firmar enlaces");
  return env.AUTH_SECRET;
}
export const alertOffToken = (alertId: string) => sign(alertId, secret(), PURPOSE);
export const alertOffUrl = (alertId: string) =>
  `${env.PUBLIC_URL}/alertas/desactivar?a=${alertId}&t=${alertOffToken(alertId)}`;
export const checkAlertOffToken = (alertId: string, token: string) =>
  verify(alertId, token, secret(), PURPOSE);
