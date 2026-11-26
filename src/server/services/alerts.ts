import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Channel } from "@/generated/prisma/client";
import { ALERT_LIMITS, checkAlertOffToken } from "@/server/alert-links";
import { db } from "@/server/db";
import { TAGS } from "./catalog";

// Límites y enlaces firmados viven en alert-links (sin Next) para que el worker los use.
export {
  ALERT_LIMITS,
  alertOffToken,
  alertOffUrl,
  checkAlertOffToken,
  pushEnabled,
} from "@/server/alert-links";

// ── Lectura ─────────────────────────────────────────────────────────────
export type UserAlert = {
  id: string;
  medicationId: number;
  medSlug: string;
  medName: string;
  strength: string;
  /** Color pastel de la condición del medicamento. */
  color: string;
  placeLabel: string;
  radiusKm: number;
  channels: Channel[];
  active: boolean;
  lastNotifiedAt: Date | null;
  /** Sucursales con existencia dentro del radio, ahora. */
  nearNow: number;
};

/** Mis alertas con cuántas sucursales tienen existencia hoy en su radio. Una consulta. */
export async function getUserAlerts(userId: string): Promise<UserAlert[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.userAlerts(userId), TAGS.availabilityAll);
  return db.$queryRaw<UserAlert[]>`
    SELECT a.id, a.medication_id AS "medicationId", m.slug AS "medSlug",
           m.active_ingredient AS "medName", m.strength, a.place_label AS "placeLabel",
           COALESCE((SELECT c.color FROM medication_conditions mc JOIN conditions c ON c.id = mc.condition_id
                     WHERE mc.medication_id = m.id ORDER BY c.sort LIMIT 1), 'lime') AS color,
           a.radius_km AS "radiusKm", a.channels::text[] AS channels, a.active,
           a.last_notified_at AS "lastNotifiedAt",
           (SELECT COUNT(*)::int FROM availability av JOIN branches b ON b.id = av.branch_id
             WHERE av.medication_id = a.medication_id AND av.status IN ('AVAILABLE','LOW')
               AND ST_DWithin(b.location, a.center, a.radius_km * 1000)) AS "nearNow"
    FROM alerts a JOIN medications m ON m.id = a.medication_id
    WHERE a.user_id = ${userId}
    ORDER BY a.created_at DESC`;
}

/** Lo que necesita el formulario: medicamentos, sucursales (para el radar) y quién tiene hoy. */
export async function getAlertFormData() {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.catalog, TAGS.availabilityAll);
  const [medications, branches, available] = await Promise.all([
    db.medication.findMany({
      select: { id: true, slug: true, activeIngredient: true, strength: true, form: true },
      orderBy: [{ activeIngredient: "asc" }, { strength: "asc" }],
    }),
    db.branch.findMany({
      select: { id: true, name: true, lat: true, lng: true },
      orderBy: { name: "asc" },
    }),
    db.availability.findMany({
      where: { status: { in: ["AVAILABLE", "LOW"] } },
      select: { branchId: true, medicationId: true },
    }),
  ]);
  return {
    medications,
    branches,
    available: available.map((a) => [a.branchId, a.medicationId] as const),
  };
}

// ── Escritura ───────────────────────────────────────────────────────────
export type AlertInput = {
  medicationId: number;
  lat: number;
  lng: number;
  placeLabel: string;
  radiusKm: number;
  channels: Channel[];
};

export async function createAlert(userId: string, input: AlertInput) {
  const count = await db.alert.count({ where: { userId } });
  if (count >= ALERT_LIMITS.perUser) return { ok: false as const, error: "too_many" as const };
  const alert = await db.alert.create({ data: { userId, ...input }, select: { id: true } });
  return { ok: true as const, id: alert.id };
}

export async function setAlertActive(userId: string, alertId: string, active: boolean) {
  await db.alert.updateMany({ where: { id: alertId, userId }, data: { active } });
}

export async function deleteAlert(userId: string, alertId: string) {
  await db.alert.deleteMany({ where: { id: alertId, userId } });
}

/** Baja desde el correo (sin sesión). Devuelve el dueño para refrescar su caché. */
export async function deactivateAlertByToken(alertId: string, token: string) {
  if (!checkAlertOffToken(alertId, token)) return null;
  const alert = await db.alert
    .update({
      where: { id: alertId },
      data: { active: false },
      select: { userId: true },
    })
    .catch(() => null);
  return alert;
}

export async function getAlertForOff(alertId: string) {
  return db.alert.findUnique({
    where: { id: alertId },
    select: {
      active: true,
      placeLabel: true,
      radiusKm: true,
      medication: { select: { activeIngredient: true, strength: true } },
    },
  });
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
) {
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, ...sub },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth, lastUsedAt: new Date() },
  });
}

export async function hasPushSubscription(userId: string) {
  return (await db.pushSubscription.count({ where: { userId } })) > 0;
}
