import "server-only";
import { redis } from "@/server/redis";

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Ventana fija en Redis: como máximo `max` usos de `key` cada `windowSec` segundos.
 * Si Redis no responde, deja pasar (mejor un reporte de más que un sitio caído).
 */
export async function limit(key: string, max: number, windowSec: number): Promise<LimitResult> {
  const k = `rl:${key}`;
  try {
    if (redis.status === "wait") await redis.connect();
    const res = await redis.multi().incr(k).expire(k, windowSec, "NX").ttl(k).exec();
    const count = Number(res?.[0]?.[1] ?? 0);
    const ttl = Number(res?.[2]?.[1] ?? windowSec);
    return count <= max ? { ok: true } : { ok: false, retryAfterSec: ttl > 0 ? ttl : windowSec };
  } catch {
    return { ok: true };
  }
}

/** Devuelve un uso (cuando la operación que lo contó terminó fallando). */
export async function release(key: string): Promise<void> {
  try {
    await redis.decr(`rl:${key}`);
  } catch {
    // sin Redis no hay nada que devolver
  }
}
