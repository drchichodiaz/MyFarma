import "server-only";
import { connection } from "next/server";
import type { PhotoStatus, Role } from "@/generated/prisma/client";
import type { Status } from "@/lib/status";
import { currentUser } from "@/server/auth";
import { db } from "@/server/db";
import { recomputeAvailability } from "./reports";

/**
 * Moderación. Sin "use cache" a propósito: el panel tiene que mostrar el estado real
 * de este momento, y lo usan muy pocas personas.
 */

/** El usuario actual si es admin; si no, null. */
export async function requireAdmin() {
  const user = await currentUser();
  return user?.role === "ADMIN" ? user : null;
}

export async function adminStats() {
  await connection();
  const [row] = await db.$queryRaw<
    {
      reportsToday: number;
      reportsWeek: number;
      usersWeek: number;
      activeAlerts: number;
      pendingPhotos: number;
      hidden: number;
      blocked: number;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM reports WHERE created_at > now() - interval '1 day') AS "reportsToday",
      (SELECT COUNT(*)::int FROM reports WHERE created_at > now() - interval '7 days') AS "reportsWeek",
      (SELECT COUNT(*)::int FROM users WHERE created_at > now() - interval '7 days') AS "usersWeek",
      (SELECT COUNT(*)::int FROM alerts WHERE active) AS "activeAlerts",
      (SELECT COUNT(*)::int FROM reports WHERE photo_status = 'PENDING') AS "pendingPhotos",
      (SELECT COUNT(*)::int FROM reports WHERE hidden) AS hidden,
      (SELECT COUNT(*)::int FROM users WHERE blocked_at IS NOT NULL) AS blocked`;
  return row!;
}

export type AdminReport = {
  id: string;
  createdAt: Date;
  status: Status;
  priceCents: number | null;
  hidden: boolean;
  photoStatus: PhotoStatus | null;
  photoKey: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userBlocked: boolean;
  medSlug: string;
  medName: string;
  strength: string;
  branchSlug: string;
  branchLabel: string;
  confirmations: number;
  disagreements: number;
};

export type ReportFilter = "todos" | "fotos" | "ocultos";

/** Reportes más recientes, paginados por cursor (fecha + id). Una consulta. */
export async function listReports(filter: ReportFilter, cursor?: string, take = 30) {
  await connection();
  const [cAt, cId] = cursor ? decodeCursor(cursor) : [null, null];
  const rows = await db.$queryRaw<AdminReport[]>`
    SELECT r.id, r.created_at AS "createdAt", r.status, r.price_cents AS "priceCents", r.hidden,
           r.photo_status AS "photoStatus", r.photo_key AS "photoKey",
           r.photo_width AS "photoWidth", r.photo_height AS "photoHeight",
           u.id AS "userId", u.name AS "userName", u.email AS "userEmail",
           (u.blocked_at IS NOT NULL) AS "userBlocked",
           m.slug AS "medSlug", m.active_ingredient AS "medName", m.strength,
           b.slug AS "branchSlug", c.name || ' ' || b.name AS "branchLabel",
           (SELECT COUNT(*)::int FROM confirmations k WHERE k.report_id = r.id AND k.agrees) AS confirmations,
           (SELECT COUNT(*)::int FROM confirmations k WHERE k.report_id = r.id AND NOT k.agrees) AS disagreements
    FROM reports r
    JOIN medications m ON m.id = r.medication_id
    JOIN branches b ON b.id = r.branch_id
    JOIN chains c ON c.id = b.chain_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE (${filter} <> 'fotos' OR r.photo_status IS NOT NULL)
      AND (${filter} <> 'ocultos' OR r.hidden OR r.photo_status = 'HIDDEN')
      AND (${cAt}::timestamp IS NULL OR (r.created_at, r.id) < (${cAt}::timestamp, ${cId}))
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ${take + 1}`;
  const more = rows.length > take;
  const page = rows.slice(0, take);
  const last = page.at(-1);
  return { reports: page, nextCursor: more && last ? encodeCursor(last.createdAt, last.id) : null };
}

/** Oculta o vuelve a mostrar un reporte y recalcula el estado de esa sucursal. */
export async function setReportHidden(reportId: string, hidden: boolean) {
  return db.$transaction(async (tx) => {
    const r = await tx.report.update({
      where: { id: reportId },
      data: { hidden },
      select: { branchId: true, medicationId: true, userId: true },
    });
    await recomputeAvailability(tx, r.branchId, r.medicationId);
    return r;
  });
}

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  blockedAt: Date | null;
  createdAt: Date;
  reports: number;
  hiddenReports: number;
  alerts: number;
};

export async function listUsers(q: string, cursor?: string, take = 30) {
  await connection();
  const like = `%${q.trim().toLowerCase()}%`;
  const [cAt, cId] = cursor ? decodeCursor(cursor) : [null, null];
  const rows = await db.$queryRaw<AdminUser[]>`
    SELECT u.id, u.name, u.email, u.role, u.blocked_at AS "blockedAt", u.created_at AS "createdAt",
           (SELECT COUNT(*)::int FROM reports r WHERE r.user_id = u.id) AS reports,
           (SELECT COUNT(*)::int FROM reports r WHERE r.user_id = u.id AND r.hidden) AS "hiddenReports",
           (SELECT COUNT(*)::int FROM alerts a WHERE a.user_id = u.id) AS alerts
    FROM users u
    WHERE (${q.trim()} = '' OR lower(coalesce(u.email, '')) LIKE ${like} OR lower(coalesce(u.name, '')) LIKE ${like})
      AND (${cAt}::timestamp IS NULL OR (u.created_at, u.id) < (${cAt}::timestamp, ${cId}))
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ${take + 1}`;
  const more = rows.length > take;
  const page = rows.slice(0, take);
  const last = page.at(-1);
  return { users: page, nextCursor: more && last ? encodeCursor(last.createdAt, last.id) : null };
}

/**
 * Bloquea o desbloquea. Al bloquear se pueden ocultar todos sus reportes de una vez;
 * se recalcula cada sucursal afectada. Devuelve los medicamentos tocados (para el caché).
 */
export async function setUserBlocked(userId: string, blocked: boolean, hideReports: boolean) {
  return db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { blockedAt: blocked ? new Date() : null },
    });
    if (!blocked || !hideReports) return [] as number[];
    const pairs = await tx.report.findMany({
      where: { userId, hidden: false },
      select: { branchId: true, medicationId: true },
      distinct: ["branchId", "medicationId"],
    });
    await tx.report.updateMany({ where: { userId }, data: { hidden: true } });
    for (const p of pairs) await recomputeAvailability(tx, p.branchId, p.medicationId);
    return [...new Set(pairs.map((p) => p.medicationId))];
  });
}

function encodeCursor(at: Date, id: string) {
  return Buffer.from(`${new Date(at).toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): [string | null, string | null] {
  const [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
  return at && id && !Number.isNaN(Date.parse(at)) ? [at, id] : [null, null];
}
