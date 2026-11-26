import "server-only";
import type { Channel } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { money } from "@/lib/format";
import { statusMeta, type Status } from "@/lib/status";
import { db } from "@/server/db";
import { sendAlertEmail } from "@/server/mail";
import { pushToUser } from "@/server/push";
import { ALERT_LIMITS, alertOffToken, alertOffUrl, pushEnabled } from "@/server/alert-links";

type Claimed = {
  id: string;
  userId: string;
  channels: Channel[];
  placeLabel: string;
  meters: number;
  email: string | null;
};

/**
 * Avisa a quienes tienen alerta para este medicamento y su radio cubre la sucursal.
 * Toma las alertas con un UPDATE … RETURNING: marca lastNotifiedAt en el mismo paso, así
 * un reintento o dos reportes seguidos nunca avisan dos veces a la misma alerta en 12 h.
 */
export async function dispatchAlerts(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      userId: true,
      hidden: true,
      medication: { select: { id: true, slug: true, activeIngredient: true, strength: true } },
      branch: {
        select: {
          id: true,
          slug: true,
          name: true,
          lat: true,
          lng: true,
          chain: { select: { name: true } },
        },
      },
    },
  });
  if (!report || report.hidden) return "skip";
  const { medication: med, branch } = report;

  // Se avisa con el estado actual, no con el del reporte (pudo cambiar mientras tanto).
  const now = await db.availability.findUnique({
    where: { branchId_medicationId: { branchId: branch.id, medicationId: med.id } },
    select: { status: true, priceCents: true },
  });
  if (!now || now.status === "OUT") return "sin existencia";

  const claimed = await db.$queryRaw<Claimed[]>`
    UPDATE alerts a SET last_notified_at = now()
    FROM branches b, users u
    WHERE b.id = ${branch.id} AND u.id = a.user_id
      AND a.medication_id = ${med.id} AND a.active
      AND a.user_id IS DISTINCT FROM ${report.userId}
      AND ST_DWithin(a.center, b.location, a.radius_km * 1000)
      AND (a.last_notified_at IS NULL
           OR a.last_notified_at < now() - make_interval(hours => ${ALERT_LIMITS.throttleHours}))
    RETURNING a.id, a.user_id AS "userId", a.channels::text[] AS channels,
              a.place_label AS "placeLabel", ST_Distance(a.center, b.location)::float AS meters,
              u.email`;
  if (!claimed.length) return "nadie que avisar";

  const status = statusMeta(now.status as Status);
  const medName = `${med.activeIngredient} ${med.strength}`;
  const branchLabel = `${branch.chain.name} ${branch.name}`;
  const path = `/m/${med.slug}/${branch.slug}`;
  const price = now.priceCents != null ? money(now.priceCents) : null;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`;

  for (const alert of claimed) {
    const distance = `${(alert.meters / 1000).toFixed(1)} km`;
    const sent: Channel[] = [];
    if (alert.channels.includes("EMAIL") && alert.email) {
      try {
        await sendAlertEmail({
          to: alert.email,
          medName,
          branchLabel,
          statusLabel: status.label,
          price,
          distance,
          placeLabel: alert.placeLabel,
          url: `${env.PUBLIC_URL}${path}`,
          directionsUrl,
          offUrl: alertOffUrl(alert.id),
          oneClickUrl: `${env.PUBLIC_URL}/api/alertas/baja?a=${alert.id}&t=${alertOffToken(alert.id)}`,
        });
        sent.push("EMAIL");
      } catch (error) {
        console.warn(`correo de alerta ${alert.id}:`, (error as Error).message);
      }
    }
    if (alert.channels.includes("PUSH") && pushEnabled) {
      const n = await pushToUser(alert.userId, {
        title: `${status.label}: ${medName}`,
        body: `${branchLabel} · a ${distance} de ${alert.placeLabel}${price ? ` · ${price}` : ""}`,
        url: path,
        tag: `alerta-${alert.id}`,
      });
      if (n > 0) sent.push("PUSH");
    }
    await db.alertDelivery.upsert({
      where: { alertId_reportId: { alertId: alert.id, reportId } },
      create: { alertId: alert.id, reportId, sent },
      update: { sent },
    });
  }
  return `avisadas ${claimed.length}`;
}
