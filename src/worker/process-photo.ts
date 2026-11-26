import "server-only";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { BUCKETS, deleteObject, getObject, putObject } from "@/server/storage";
import { renderVariants } from "./variants";

export async function processPhoto(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { photoKey: true, photoStatus: true, medicationId: true, userId: true },
  });
  if (!report?.photoKey || report.photoStatus !== "PENDING") return "skip";

  const original = await getObject(BUCKETS.uploads, report.photoKey);
  const variants = await renderVariants(original);
  const prefix = `r/${reportId}`;
  await Promise.all(
    variants.map((v) =>
      putObject(BUCKETS.photos, `${prefix}/${v.width}.${v.ext}`, v.body, `image/${v.ext}`),
    ),
  );
  const biggest = variants.at(-1)!;
  await db.report.update({
    where: { id: reportId },
    data: { photoStatus: "READY", photoKey: prefix, photoWidth: biggest.w, photoHeight: biggest.h },
  });
  await deleteObject(BUCKETS.uploads, report.photoKey);
  await notifyApp(report.medicationId, report.userId);
  return "ready";
}

/** Después del último intento fallido: se marca y se borra el original (puede traer GPS). */
export async function failPhoto(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { photoKey: true, photoStatus: true, medicationId: true, userId: true },
  });
  if (!report || report.photoStatus !== "PENDING") return;
  await db.report.update({ where: { id: reportId }, data: { photoStatus: "FAILED" } });
  if (report.photoKey) await deleteObject(BUCKETS.uploads, report.photoKey).catch(() => {});
  await notifyApp(report.medicationId, report.userId);
}

/** Pide a la app que refresque las páginas donde aparece la foto. */
async function notifyApp(medicationId: number, userId: string | null) {
  if (!env.INTERNAL_SECRET) return;
  const tags = [`availability:${medicationId}`, ...(userId ? [`reports:user:${userId}`] : [])];
  try {
    await fetch(`${env.APP_INTERNAL_URL}/api/internal/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": env.INTERNAL_SECRET },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    // La foto ya está lista; la página se actualiza sola cuando venza su caché.
    console.warn("No se pudo avisar a la app:", error);
  }
}
