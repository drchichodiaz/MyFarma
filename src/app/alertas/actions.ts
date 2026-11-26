"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/server/auth";
import { limit } from "@/server/rate-limit";
import { pushToUser } from "@/server/push";
import {
  ALERT_LIMITS,
  createAlert,
  deactivateAlertByToken,
  deleteAlert,
  pushEnabled,
  savePushSubscription,
  setAlertActive,
} from "@/server/services/alerts";
import { TAGS } from "@/server/services/catalog";

export type AlertFormState =
  { status: "idle" } | { status: "error"; message: string } | { status: "ok"; id: string };

const alertSchema = z.object({
  medicationId: z.coerce.number().int().positive(),
  lat: z.coerce.number().min(7).max(9.8),
  lng: z.coerce.number().min(-83.1).max(-77.1),
  placeLabel: z.string().trim().min(2).max(60),
  radiusKm: z.coerce.number().min(ALERT_LIMITS.minKm).max(ALERT_LIMITS.maxKm),
  channels: z.array(z.enum(["EMAIL", "PUSH"])).min(1),
});

export async function createAlertAction(
  _prev: AlertFormState,
  form: FormData,
): Promise<AlertFormState> {
  const user = await currentUser();
  if (!user) return { status: "error", message: "Tu sesión venció. Vuelve a entrar." };
  const parsed = alertSchema.safeParse({
    ...Object.fromEntries(form),
    channels: form.getAll("channels"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      status: "error",
      message:
        field === "channels"
          ? "Elige al menos una forma de avisarte."
          : field === "lat" || field === "lng"
            ? "Elige dónde: tu ubicación o un barrio de la lista."
            : "Revisa los datos de la alerta.",
    };
  }
  // Redondeo a ~100 m: no guardamos la ubicación exacta de nadie.
  const data = {
    ...parsed.data,
    lat: Math.round(parsed.data.lat * 1000) / 1000,
    lng: Math.round(parsed.data.lng * 1000) / 1000,
  };
  const result = await createAlert(user.id, data);
  if (!result.ok) {
    return {
      status: "error",
      message: `Puedes tener hasta ${ALERT_LIMITS.perUser} alertas. Borra una que ya no uses.`,
    };
  }
  updateTag(TAGS.userAlerts(user.id));
  return { status: "ok", id: result.id };
}

export async function setAlertActiveAction(alertId: string, active: boolean) {
  const user = await currentUser();
  if (!user) return;
  await setAlertActive(user.id, alertId, active);
  updateTag(TAGS.userAlerts(user.id));
}

export async function deleteAlertAction(alertId: string) {
  const user = await currentUser();
  if (!user) return;
  await deleteAlert(user.id, alertId);
  updateTag(TAGS.userAlerts(user.id));
}

const subSchema = z.object({
  endpoint: z.url().max(1000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(8).max(100),
});

/** Guarda la suscripción push de este navegador. */
export async function savePushAction(input: unknown): Promise<{ ok: boolean }> {
  const user = await currentUser();
  if (!user || !pushEnabled) return { ok: false };
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  await savePushSubscription(user.id, parsed.data);
  return { ok: true };
}

/** "Probar aviso": manda un push de prueba a los navegadores del usuario. */
export async function testPushAction(): Promise<{ delivered: number; error?: string }> {
  const user = await currentUser();
  if (!user || !pushEnabled) return { delivered: 0, error: "No disponible." };
  const rl = await limit(`push-test:${user.id}`, 5, 60 * 60);
  if (!rl.ok) return { delivered: 0, error: "Ya probaste varias veces. Intenta en un rato." };
  const delivered = await pushToUser(user.id, {
    title: "MyFarma: aviso de prueba",
    body: "Así te avisaremos cuando alguien reporte tu medicamento cerca.",
    url: "/alertas",
    tag: "prueba",
  });
  return { delivered };
}

/** Baja desde el enlace del correo (sin sesión, con firma). */
export async function deactivateFromEmailAction(form: FormData) {
  const alert = await deactivateAlertByToken(
    String(form.get("a") ?? ""),
    String(form.get("t") ?? ""),
  );
  if (alert) updateTag(TAGS.userAlerts(alert.userId));
}
