/**
 * Worker de MyFarma (contenedor aparte, mismo código que la app).
 *
 *   pnpm worker   →   tsx --conditions=react-server src/worker/index.ts
 *
 * --conditions=react-server: permite importar los módulos "server-only" de src/server.
 */
import { Worker } from "bullmq";
import { db } from "@/server/db";
import { enqueuePhoto, PHOTO_QUEUE, queueConnection, type PhotoJob } from "@/server/queue";
import { photosEnabled } from "@/server/storage";
import { failPhoto, processPhoto } from "./process-photo";

if (!photosEnabled) {
  console.error("Faltan las variables R2_PHOTOS_*: el worker no puede procesar fotos.");
  process.exit(1);
}

const worker = new Worker<PhotoJob>(PHOTO_QUEUE, async (job) => processPhoto(job.data.reportId), {
  connection: queueConnection(),
  concurrency: 1,
});

worker.on("completed", (job, result) => console.log(`✓ foto ${job.data.reportId}: ${result}`));
worker.on("failed", async (job, error) => {
  if (!job) return;
  console.error(`✗ foto ${job.data.reportId} (intento ${job.attemptsMade}):`, error.message);
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) await failPhoto(job.data.reportId);
});

/**
 * Barrido: Redis no guarda la cola en disco, así que tras un reinicio se re-encolan
 * las fotos que quedaron en PENDING. El jobId evita duplicados.
 */
async function sweep() {
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
  await worker.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("▶ worker de fotos listo");
