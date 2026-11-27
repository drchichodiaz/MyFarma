import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/server/db";
import { DEFAULT_RADIUS_M } from "@/lib/geo";
import { env } from "@/lib/env";
import { publicName, reporterName } from "@/lib/people";
import type { Status } from "@/lib/status";
import { TAGS } from "./catalog";

export type NearbyBranch = {
  branchId: number;
  branchSlug: string;
  name: string;
  address: string;
  hours: string | null;
  lat: number;
  lng: number;
  chainName: string;
  chainColor: string;
  status: Status | null;
  priceCents: number | null;
  confirmedAt: Date | null;
  confirmations: number;
  meters: number;
};

/**
 * Sucursales cerca de un punto con el estado de un medicamento.
 * Una sola consulta: sucursal + cadena + disponibilidad + distancia (índice GIST en location).
 */
export async function getNearbyAvailability(
  medicationId: number,
  lat: number,
  lng: number,
  radiusM = DEFAULT_RADIUS_M,
  limit = 50,
): Promise<NearbyBranch[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.availability(medicationId), TAGS.availabilityAll);

  return db.$queryRaw<NearbyBranch[]>`
    WITH here AS (SELECT ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography AS g)
    SELECT b.id AS "branchId", b.slug AS "branchSlug", b.name, b.address, b.hours, b.lat, b.lng,
           c.name AS "chainName", c.color AS "chainColor",
           a.status, a.price_cents AS "priceCents", a.confirmed_at AS "confirmedAt",
           COALESCE(a.confirmations, 0)::int AS confirmations,
           ST_Distance(b.location, here.g)::float AS meters
    FROM branches b
    CROSS JOIN here
    JOIN chains c ON c.id = b.chain_id
    LEFT JOIN availability a ON a.branch_id = b.id AND a.medication_id = ${medicationId}
    WHERE ST_DWithin(b.location, here.g, ${radiusM})
    ORDER BY meters
    LIMIT ${limit}`;
}

export type ScarceOverview = {
  medicationId: number;
  available: number;
  total: number;
  minPriceCents: number | null;
};

/** Para las tarjetas de "Escaseando hoy": cuántas sucursales tienen y el precio más bajo. */
export async function getScarceOverview(): Promise<ScarceOverview[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.overview, TAGS.availabilityAll);

  return db.$queryRaw<ScarceOverview[]>`
    SELECT m.id AS "medicationId",
           COUNT(a.*) FILTER (WHERE a.status IN ('AVAILABLE','LOW'))::int AS available,
           (SELECT COUNT(*)::int FROM branches) AS total,
           MIN(a.price_cents) FILTER (WHERE a.status IN ('AVAILABLE','LOW'))::int AS "minPriceCents"
    FROM medications m
    LEFT JOIN availability a ON a.medication_id = m.id
    WHERE m.scarce_in_css
    GROUP BY m.id`;
}

export type RecentReport = {
  id: string;
  who: string;
  status: Status;
  createdAt: Date;
  medSlug: string;
  medName: string;
  strength: string;
  branchSlug: string;
  branchName: string;
  chainName: string;
};

/** Últimos reportes visibles, para "En vivo" en la portada. */
export async function getRecentReports(limit = 5): Promise<RecentReport[]> {
  "use cache";
  cacheLife("seconds");
  cacheTag(TAGS.reports);

  const rows = await db.$queryRaw<(RecentReport & { source: "USER" | "CALL" })[]>`
    SELECT r.id, u.name AS who, r.source, r.status, r.created_at AS "createdAt",
           m.slug AS "medSlug", m.active_ingredient AS "medName", m.strength,
           b.slug AS "branchSlug", b.name AS "branchName", c.name AS "chainName"
    FROM reports r
    JOIN medications m ON m.id = r.medication_id
    JOIN branches b ON b.id = r.branch_id
    JOIN chains c ON c.id = b.chain_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE NOT r.hidden
    ORDER BY r.created_at DESC
    LIMIT ${limit}`;
  return rows.map(({ source, ...r }) => ({ ...r, who: reporterName(r.who, source) }));
}

export type BranchDetail = {
  id: number;
  slug: string;
  name: string;
  address: string;
  phone: string | null;
  hours: string | null;
  lat: number;
  lng: number;
  verified: boolean;
  placeId: string | null;
  chainName: string;
  chainColor: string;
};

export async function getBranch(slug: string): Promise<BranchDetail | null> {
  "use cache";
  cacheLife("days");
  cacheTag(TAGS.catalog);
  const b = await db.branch.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      phone: true,
      hours: true,
      lat: true,
      lng: true,
      verified: true,
      placeId: true,
      chain: { select: { name: true, color: true } },
    },
  });
  if (!b) return null;
  const { chain, ...rest } = b;
  return { ...rest, chainName: chain.name, chainColor: chain.color };
}

/** Estado actual + últimos reportes de un medicamento en una sucursal (paginado por cursor). */
export async function getBranchMedication(
  branchId: number,
  medicationId: number,
  cursor?: string,
  take = 10,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.availability(medicationId));

  const [availability, reports] = await Promise.all([
    db.availability.findUnique({
      where: { branchId_medicationId: { branchId, medicationId } },
      select: {
        status: true,
        priceCents: true,
        confirmedAt: true,
        confirmations: true,
        lastReportId: true,
      },
    }),
    db.report.findMany({
      where: { branchId, medicationId, hidden: false },
      select: {
        id: true,
        status: true,
        priceCents: true,
        createdAt: true,
        photoKey: true,
        photoStatus: true,
        photoWidth: true,
        photoHeight: true,
        source: true,
        user: { select: { name: true } },
        confirmations: {
          select: { agrees: true, user: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
          take: 6,
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = reports.length > take;
  return {
    availability,
    reports: reports
      .slice(0, take)
      .map(
        ({
          user,
          source,
          confirmations,
          photoKey,
          photoStatus,
          photoWidth,
          photoHeight,
          ...r
        }) => ({
          ...r,
          // Solo las fotos ya procesadas (sin EXIF/GPS) llegan a la página.
          photo:
            photoStatus === "READY" && photoKey && photoWidth && photoHeight
              ? {
                  base: env.PHOTOS_PUBLIC_URL,
                  prefix: photoKey,
                  width: photoWidth,
                  height: photoHeight,
                }
              : null,
          photoPending: photoStatus === "PENDING",
          who: reporterName(user?.name, source),
          agreed: confirmations.filter((c) => c.agrees).map((c) => publicName(c.user.name)),
          disagreed: confirmations.filter((c) => !c.agrees).map((c) => publicName(c.user.name)),
        }),
      ),
    nextCursor: hasMore ? reports[take - 1]!.id : null,
  };
}

export type MyVote = { own: boolean; agrees: boolean | null };

/** Si el reporte es mío y cómo voté. Por usuario: se invalida con sus reportes y votos. */
export async function getMyVote(userId: string, reportId: string): Promise<MyVote> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.userReports(userId), `report:${reportId}`);

  const rows = await db.$queryRaw<{ own: boolean; agrees: boolean | null }[]>`
    SELECT r.user_id IS NOT DISTINCT FROM ${userId} AS own, c.agrees
    FROM reports r
    LEFT JOIN confirmations c ON c.report_id = r.id AND c.user_id = ${userId}
    WHERE r.id = ${reportId}`;
  return rows[0] ?? { own: false, agrees: null };
}
