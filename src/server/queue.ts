import "server-only";
import { Queue } from "bullmq";
import { env } from "@/lib/env";

/** Trabajo de la cola "photos": procesar la foto de un reporte. */
export type PhotoJob = { reportId: string };

export const PHOTO_QUEUE = "photos";

/** BullMQ necesita su propia conexión, sin límite de reintentos por comando. */
export function queueConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

let queue: Queue<PhotoJob> | null = null;

export async function enqueuePhoto(reportId: string) {
  queue ??= new Queue<PhotoJob>(PHOTO_QUEUE, { connection: queueConnection() });
  // jobId = reportId: si el barrido del worker lo vuelve a encolar, no se duplica.
  await queue.add(
    "process",
    { reportId },
    {
      jobId: reportId,
      attempts: 4,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  );
}
