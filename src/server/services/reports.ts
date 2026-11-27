import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { computeAvailability, type AvailabilityEvent } from "@/lib/availability-rules";
import type { Status } from "@/lib/status";
import { db } from "@/server/db";
import { enqueueAlerts, enqueuePhoto } from "@/server/queue";
import { limit, release } from "@/server/rate-limit";
import { BUCKETS, deleteObject, headObject, photosEnabled } from "@/server/storage";
import { PHOTO_WIDTHS } from "@/lib/photos";
import type { CallSheetInput } from "@/lib/call-sheet";
import { TAGS } from "./catalog";

/** Límites contra abuso (PLAN.md → Reglas contra abuso). */
export const LIMITS = {
  reportsPerHour: 10,
  samePairMinutes: 30,
  confirmationsPerHour: 30,
} as const;

/** Solo cuentan los últimos 90 días para el estado actual. */
const HISTORY_DAYS = 90;

type Tx = Prisma.TransactionClient;

/**
 * Recalcula el estado actual de (sucursal, medicamento) desde su historial reciente.
 * Va dentro de la misma transacción que el reporte o la confirmación.
 */
export async function recomputeAvailability(tx: Tx, branchId: number, medicationId: number) {
  // Dos reportes a la vez sobre el mismo par: el segundo espera y ve al primero.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${branchId}::int, ${medicationId}::int)`;
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const reports = await tx.report.findMany({
    where: { branchId, medicationId, hidden: false, createdAt: { gte: since } },
    select: {
      id: true,
      userId: true,
      status: true,
      priceCents: true,
      createdAt: true,
      confirmations: { select: { userId: true, agrees: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const events: AvailabilityEvent[] = reports.flatMap((r) => [
    {
      kind: "report" as const,
      id: r.id,
      userId: r.userId,
      status: r.status,
      priceCents: r.priceCents,
      at: r.createdAt,
    },
    ...r.confirmations.map((c) => ({
      kind: "confirmation" as const,
      reportStatus: r.status,
      userId: c.userId,
      agrees: c.agrees,
      at: c.createdAt,
    })),
  ]);

  const next = computeAvailability(events);
  const key = { branchId_medicationId: { branchId, medicationId } };
  if (!next) {
    await tx.availability.deleteMany({ where: { branchId, medicationId } });
    return null;
  }
  await tx.availability.upsert({
    where: key,
    create: { branchId, medicationId, ...next },
    update: next,
  });
  return next;
}

export type ReportInput = {
  medicationId: number;
  branchId: number;
  status: Status;
  priceCents: number | null;
  /** Clave del original ya subido a R2 (uploads/u/<userId>/…). */
  photoKey?: string | null;
};

export type ReportResult =
  | { ok: true; reportId: string; medicationId: number }
  | {
      ok: false;
      error: "rate_hour" | "rate_pair" | "not_found" | "bad_photo";
      retryAfterSec?: number;
    };

/** Prefijo de las subidas de un usuario: nadie puede adjuntar la foto de otro. */
export const uploadPrefix = (userId: string) => `u/${userId}/`;

export async function createReport(userId: string, input: ReportInput): Promise<ReportResult> {
  const pairKey = `report:pair:${userId}:${input.branchId}:${input.medicationId}`;
  const pair = await limit(pairKey, 1, LIMITS.samePairMinutes * 60);
  if (!pair.ok) return { ok: false, error: "rate_pair", retryAfterSec: pair.retryAfterSec };
  const hour = await limit(`report:user:${userId}`, LIMITS.reportsPerHour, 60 * 60);
  if (!hour.ok) {
    await release(pairKey);
    return { ok: false, error: "rate_hour", retryAfterSec: hour.retryAfterSec };
  }

  const photoKey = input.photoKey || null;
  const [med, branch, photoSize] = await Promise.all([
    db.medication.findUnique({ where: { id: input.medicationId }, select: { id: true } }),
    db.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }),
    photoKey && photosEnabled && photoKey.startsWith(uploadPrefix(userId))
      ? headObject(BUCKETS.uploads, photoKey)
      : Promise.resolve(photoKey ? null : 0),
  ]);
  if (!med || !branch || photoSize === null) {
    await Promise.all([release(pairKey), release(`report:user:${userId}`)]);
    return { ok: false, error: photoSize === null ? "bad_photo" : "not_found" };
  }

  const { report, next } = await db.$transaction(async (tx) => {
    const r = await tx.report.create({
      data: {
        userId,
        medicationId: input.medicationId,
        branchId: input.branchId,
        status: input.status,
        priceCents: input.status === "OUT" ? null : input.priceCents,
        ...(photoKey && { photoKey, photoStatus: "PENDING" as const }),
      },
      select: { id: true },
    });
    const n = await recomputeAvailability(tx, input.branchId, input.medicationId);
    return { report: r, next: n };
  });

  // Si Redis falla, el barrido del worker la encola en unos minutos.
  if (photoKey) await enqueuePhoto(report.id).catch((e) => console.warn("enqueuePhoto:", e));
  // Hay o Quedan pocas → avisar a quienes tienen alerta cerca (el worker decide a quién).
  if (next && next.status !== "OUT") {
    await enqueueAlerts(report.id).catch((e) => console.warn("enqueueAlerts:", e));
  }

  return { ok: true, reportId: report.id, medicationId: input.medicationId };
}

/**
 * Carga rápida del equipo (llamada a la farmacia): varios reportes de un medicamento en una sola
 * transacción, sin límites por hora (solo ADMIN llega aquí). Salen en público como "MyFarma (llamada)".
 */
export async function createCallReports(
  adminId: string,
  input: CallSheetInput,
): Promise<{ ok: true; saved: number; alerts: number } | { ok: false; error: string }> {
  const branchIds = input.entries.map((e) => e.branchId);
  const [med, found] = await Promise.all([
    db.medication.findUnique({ where: { id: input.medicationId }, select: { id: true } }),
    db.branch.count({ where: { id: { in: branchIds } } }),
  ]);
  if (!med) return { ok: false, error: "Ese medicamento no existe." };
  if (found !== branchIds.length) return { ok: false, error: "Alguna sucursal ya no existe." };

  // Orden fijo de los candados para que dos cargas a la vez no se bloqueen entre sí.
  const entries = [...input.entries].sort((a, b) => a.branchId - b.branchId);
  const withStock = await db.$transaction(
    async (tx) => {
      const alertIds: string[] = [];
      for (const e of entries) {
        const r = await tx.report.create({
          data: {
            userId: adminId,
            medicationId: input.medicationId,
            branchId: e.branchId,
            status: e.status,
            priceCents: e.status === "OUT" ? null : input.priceCents,
            source: "CALL",
          },
          select: { id: true },
        });
        const next = await recomputeAvailability(tx, e.branchId, input.medicationId);
        if (next && next.status !== "OUT") alertIds.push(r.id);
      }
      return alertIds;
    },
    { timeout: 30_000 },
  );

  for (const id of withStock) {
    await enqueueAlerts(id).catch((e) => console.warn("enqueueAlerts:", e));
  }
  return { ok: true, saved: entries.length, alerts: withStock.length };
}

export type ConfirmResult =
  | { ok: true; medicationId: number }
  | { ok: false; error: "rate_hour" | "not_found" | "own_report" | "not_current" };

/**
 * "Sí había / No había" sobre el reporte vigente de una sucursal.
 * Un voto por persona por reporte: si vuelve a votar, se cambia su voto.
 */
export async function confirmReport(
  userId: string,
  reportId: string,
  agrees: boolean,
): Promise<ConfirmResult> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { userId: true, branchId: true, medicationId: true, hidden: true },
  });
  if (!report || report.hidden) return { ok: false, error: "not_found" };
  if (report.userId === userId) return { ok: false, error: "own_report" };

  const current = await db.availability.findUnique({
    where: {
      branchId_medicationId: { branchId: report.branchId, medicationId: report.medicationId },
    },
    select: { lastReportId: true },
  });
  if (current?.lastReportId !== reportId) return { ok: false, error: "not_current" };

  const rl = await limit(`confirm:user:${userId}`, LIMITS.confirmationsPerHour, 60 * 60);
  if (!rl.ok) return { ok: false, error: "rate_hour" };

  const next = await db.$transaction(async (tx) => {
    await tx.confirmation.upsert({
      where: { reportId_userId: { reportId, userId } },
      create: { reportId, userId, agrees },
      update: { agrees, createdAt: new Date() },
    });
    return recomputeAvailability(tx, report.branchId, report.medicationId);
  });
  // "Sí había" sobre un No hay vuelve a poner existencia: también avisa.
  if (next && next.status !== "OUT") {
    await enqueueAlerts(reportId).catch((e) => console.warn("enqueueAlerts:", e));
  }
  return { ok: true, medicationId: report.medicationId };
}

export type UserReport = {
  id: string;
  status: Status;
  priceCents: number | null;
  createdAt: Date;
  hidden: boolean;
  medSlug: string;
  medName: string;
  strength: string;
  branchSlug: string;
  branchName: string;
  chainName: string;
  confirmations: number;
};

/** Mis reportes (página /cuenta). */
export async function getUserReports(userId: string, take = 20): Promise<UserReport[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.userReports(userId));

  return db.$queryRaw<UserReport[]>`
    SELECT r.id, r.status, r.price_cents AS "priceCents", r.created_at AS "createdAt", r.hidden,
           m.slug AS "medSlug", m.active_ingredient AS "medName", m.strength,
           b.slug AS "branchSlug", b.name AS "branchName", c.name AS "chainName",
           (SELECT COUNT(*)::int FROM confirmations k WHERE k.report_id = r.id AND k.agrees) AS confirmations
    FROM reports r
    JOIN medications m ON m.id = r.medication_id
    JOIN branches b ON b.id = r.branch_id
    JOIN chains c ON c.id = b.chain_id
    WHERE r.user_id = ${userId}
    ORDER BY r.created_at DESC
    LIMIT ${take}`;
}

/** Medicamentos y sucursales para los selectores del formulario de reporte. */
export async function getReportOptions() {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);

  const [medications, branches] = await Promise.all([
    db.medication.findMany({
      select: { id: true, slug: true, activeIngredient: true, strength: true, form: true },
      orderBy: [{ activeIngredient: "asc" }, { strength: "asc" }],
    }),
    db.branch.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        chain: { select: { name: true, color: true } },
      },
      orderBy: [{ chain: { name: "asc" } }, { name: "asc" }],
    }),
  ]);
  return {
    medications,
    branches: branches.map(({ chain, ...b }) => ({
      ...b,
      chainName: chain.name,
      chainColor: chain.color,
    })),
  };
}

/**
 * Moderación: oculta la foto de un reporte y borra sus variantes públicas
 * (ocultarla en la página no basta: la URL seguiría funcionando).
 */
export async function hidePhoto(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { photoKey: true, photoStatus: true, medicationId: true, userId: true },
  });
  if (!report?.photoKey) return null;
  if (report.photoStatus === "READY") {
    await Promise.all(
      PHOTO_WIDTHS.flatMap((w) =>
        (["avif", "webp"] as const).map((ext) =>
          deleteObject(BUCKETS.photos, `${report.photoKey}/${w}.${ext}`),
        ),
      ),
    );
  } else if (report.photoStatus === "PENDING") {
    await deleteObject(BUCKETS.uploads, report.photoKey);
  }
  await db.report.update({ where: { id: reportId }, data: { photoStatus: "HIDDEN" } });
  return { medicationId: report.medicationId, userId: report.userId };
}
