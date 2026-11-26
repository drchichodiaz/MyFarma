import { connection } from "next/server";
import { db } from "@/server/db";
import { redis } from "@/server/redis";

type Check = { ok: boolean; ms: number; detail?: string };

/** Ejecuta una verificación con timeout y mide cuánto tardó. */
async function check(fn: () => Promise<string>, timeoutMs = 2_000): Promise<Check> {
  const start = performance.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return { ok: true, ms: Math.round(performance.now() - start), detail };
  } catch (error) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      detail: error instanceof Error ? error.message : "error",
    };
  }
}

/** GET /api/health — estado de Postgres/PostGIS y Redis. Lo usan Docker y el monitoreo. */
export async function GET() {
  await connection(); // siempre en tiempo de petición, nunca prerenderizado

  const [postgis, cache] = await Promise.all([
    check(async () => {
      const rows = await db.$queryRaw<{ v: string }[]>`SELECT postgis_lib_version() AS v`;
      return `postgis ${rows[0]?.v}`;
    }),
    check(async () => {
      if (redis.status === "wait") await redis.connect();
      return await redis.ping();
    }),
  ]);

  const ok = postgis.ok && cache.ok;
  return Response.json(
    { status: ok ? "ok" : "degraded", postgis, redis: cache },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
