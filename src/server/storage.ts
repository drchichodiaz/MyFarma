import "server-only";
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";

/**
 * Cloudflare R2 (API de S3) para las fotos:
 * - uploads: privado. Recibe el original directo desde el navegador; el worker lo borra.
 * - photos: público en img.myfarma.net. Solo variantes limpias (sin EXIF/GPS).
 */
export const photosEnabled = Boolean(
  env.R2_ACCOUNT_ID && env.R2_PHOTOS_ACCESS_KEY_ID && env.R2_PHOTOS_SECRET_ACCESS_KEY,
);

let client: AwsClient | null = null;
function r2() {
  if (!photosEnabled) throw new Error("R2 no está configurado (R2_PHOTOS_*)");
  client ??= new AwsClient({
    accessKeyId: env.R2_PHOTOS_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_PHOTOS_SECRET_ACCESS_KEY!,
    service: "s3",
    region: "auto",
  });
  return client;
}

const objectUrl = (bucket: string, key: string) =>
  `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;

export const BUCKETS = { uploads: env.R2_UPLOADS_BUCKET, photos: env.R2_PHOTOS_BUCKET } as const;

/**
 * URL firmada para subir UN archivo con tipo y tamaño exactos (vale 5 minutos).
 * El navegador tiene que mandar los mismos Content-Type y Content-Length o R2 lo rechaza.
 */
export async function presignUpload(key: string, contentType: string, contentLength: number) {
  const url = new URL(objectUrl(BUCKETS.uploads, key));
  url.searchParams.set("X-Amz-Expires", "300");
  const signed = await r2().sign(url.toString(), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(contentLength) },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

async function call(method: string, bucket: string, key: string, init: RequestInit = {}) {
  const res = await r2().fetch(objectUrl(bucket, key), {
    method,
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  if (
    !res.ok &&
    !(method === "HEAD" && res.status === 404) &&
    !(method === "DELETE" && res.status === 404)
  ) {
    throw new Error(`R2 ${method} ${bucket}/${key}: ${res.status}`);
  }
  return res;
}

/** Tamaño del objeto o null si no existe. */
export async function headObject(bucket: string, key: string): Promise<number | null> {
  const res = await call("HEAD", bucket, key);
  return res.ok ? Number(res.headers.get("content-length") ?? 0) : null;
}

export async function getObject(bucket: string, key: string): Promise<Buffer> {
  const res = await call("GET", bucket, key);
  return Buffer.from(await res.arrayBuffer());
}

export async function putObject(bucket: string, key: string, body: Buffer, contentType: string) {
  await call("PUT", bucket, key, {
    body: new Uint8Array(body),
    headers: {
      "content-type": contentType,
      // Las variantes nunca cambian: la clave lleva el id del reporte.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

export async function deleteObject(bucket: string, key: string) {
  await call("DELETE", bucket, key);
}
