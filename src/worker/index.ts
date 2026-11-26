/**
 * Worker de MyFarma (contenedor aparte, mismo código que la app): alertas y fotos.
 *
 *   pnpm worker   →   tsx --conditions=react-server src/worker/index.ts
 *
 * --conditions=react-server: permite importar los módulos "server-only" de src/server.
 */
import { Worker } from "bullmq";
import { db } from "@/server/db";
import {
  ALERT_QUEUE,
  enqueuePhoto,
  PHOTO_QUEUE,
  queueConnection,
  type AlertJob,
  type PhotoJob,
} from "@/server/queue";
import { photosEnabled } from "@/server/storage";
import { dispatchAlerts } from "./dispatch-alerts";
import { failPhoto, processPhoto } from "./process-photo";

const workers: Worker[] = [];

// ── Alertas (siempre) ──
const alerts = new Worker<AlertJob>(ALERT_QUEUE, async (job) => dispatchAlerts(job.data.reportId), {
  connection: queueConnection(),
  concurrency: 2,
});
alerts.on("completed", (job, result) => console.log(`✓ alertas ${job.data.reportId}: ${result}`));
alerts.on("failed", (job, error) =>
  console.error(`✗ alertas ${job?.data.reportId} (intento ${job?.attemptsMade}):`, error.message),
);
workers.push(alerts);

// ── Fotos (solo si R2 está configurado) ──
if (photosEnabled) {
  const photos = new Worker<PhotoJob>(PHOTO_QUEUE, async (job) => processPhoto(job.data.reportId), {
    connection: queueConnection(),
    concurrency: 1,
  });
  photos.on("completed", (job, result) => console.log(`✓ foto ${job.data.reportId}: ${result}`));
  photos.on("failed", async (job, error) => {
    if (!job) return;
    console.error(`✗ foto ${job.data.reportId} (intento ${job.attemptsMade}):`, error.message);
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) await failPhoto(job.data.reportId);
  });
  workers.push(photos);
} else {
  console.warn("Sin R2_PHOTOS_*: el worker no procesa fotos (solo alertas).");
}

/**
 * Barrido: Redis no guarda la cola en disco, así que tras un reinicio se re-encolan
 * las fotos que quedaron en PENDING. El jobId evita duplicados.
 */
async function sweep() {
  if (!photosEnabled) return;
  const stuck = await db.report.findMany({
    where: { photoStatus: "PENDING", createdAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
    take: 100,
  });
  for (const r of stuck) await enqueuePhoto(r.id);
  if (stuck.length) console.log(`↻ re-encoladas ${stuck.length} fotos pendientes`);
}
void sweep();
const timer = setInterval(() => void sweep().catch(console.error), 5 * 60_000);

async function shutdown() {
  clearInterval(timer);
  await Promise.all(workers.map((w) => w.close()));
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log(`▶ worker listo (${photosEnabled ? "alertas + fotos" : "alertas"})`);
