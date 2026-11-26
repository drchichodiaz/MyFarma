import { type NextRequest } from "next/server";
import { searchMedications, type SearchHit } from "@/server/services/catalog";
import { redis } from "@/server/redis";
import { normalize } from "@/lib/text";

const TTL_SECONDS = 300;

/** Redis es una optimización: si no responde, se consulta Postgres directamente. */
async function cached(key: string, load: () => Promise<SearchHit[]>) {
  try {
    if (redis.status === "wait") await redis.connect();
    const hit = await redis.get(key);
    if (hit) return { hits: JSON.parse(hit) as SearchHit[], cache: "HIT" };
  } catch {
    return { hits: await load(), cache: "BYPASS" };
  }
  const hits = await load();
  redis.set(key, JSON.stringify(hits), "EX", TTL_SECONDS).catch(() => {});
  return { hits, cache: "MISS" };
}

/** GET /api/search?q=metotrexato — autocompletado del buscador. */
export async function GET(request: NextRequest) {
  const q = normalize(request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  if (q.length < 2) return Response.json({ hits: [] });

  const { hits, cache } = await cached(`search:v1:${q}`, () => searchMedications(q));
  return Response.json(
    { hits },
    {
      headers: {
        // El navegador y Cloudflare pueden reutilizarla un rato: el catálogo cambia poco.
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": cache,
      },
    },
  );
}
