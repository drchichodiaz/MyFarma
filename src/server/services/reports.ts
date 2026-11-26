import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { computeAvailability, type AvailabilityEvent } from "@/lib/availability-rules";
import type { Status } from "@/lib/status";
import { db } from "@/server/db";
import { limit, release } from "@/server/rate-limit";
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
};

export type ReportResult =
  | { ok: true; reportId: string; medicationId: number }
  | { ok: false; error: "rate_hour" | "rate_pair" | "not_found"; retryAfterSec?: number };

export async function createReport(userId: string, input: ReportInput): Promise<ReportResult> {
  const pairKey = `report:pair:${userId}:${input.branchId}:${input.medicationId}`;
  const pair = await limit(pairKey, 1, LIMITS.samePairMinutes * 60);
  if (!pair.ok) return { ok: false, error: "rate_pair", retryAfterSec: pair.retryAfterSec };
  const hour = await limit(`report:user:${userId}`, LIMITS.reportsPerHour, 60 * 60);
  if (!hour.ok) {
    await release(pairKey);
    return { ok: false, error: "rate_hour", retryAfterSec: hour.retryAfterSec };
  }

  const [med, branch] = await Promise.all([
    db.medication.findUnique({ where: { id: input.medicationId }, select: { id: true } }),
    db.branch.findUnique({ where: { id: input.branchId }, select: { id: true } }),
  ]);
  if (!med || !branch) {
    await Promise.all([release(pairKey), release(`report:user:${userId}`)]);
    return { ok: false, error: "not_found" };
  }

  const report = await db.$transaction(async (tx) => {
    const r = await tx.report.create({
      data: {
        userId,
        medicationId: input.medicationId,
        branchId: input.branchId,
        status: input.status,
        priceCents: input.status === "OUT" ? null : input.priceCents,
      },
      select: { id: true },
    });
    await recomputeAvailability(tx, input.branchId, input.medicationId);
    return r;
  });

  return { ok: true, reportId: report.id, medicationId: input.medicationId };
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

  await db.$transaction(async (tx) => {
    await tx.confirmation.upsert({
      where: { reportId_userId: { reportId, userId } },
      create: { reportId, userId, agrees },
      update: { agrees, createdAt: new Date() },
    });
    await recomputeAvailability(tx, report.branchId, report.medicationId);
  });
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
