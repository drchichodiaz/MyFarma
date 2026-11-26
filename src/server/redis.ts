import "server-only";
import Redis from "ioredis";
import { env } from "@/lib/env";

/**
 * Conexión Redis compartida (caché y límites de uso).
 * Los timeouts evitan que una caída de Redis cuelgue las peticiones.
 */
function createRedis() {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 3_000,
    commandTimeout: 1_000,
    maxRetriesPerRequest: 2,
  });
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
