/** Reglas de las fotos de reportes, compartidas por el navegador, la app y el worker. */

/** Anchos de las variantes que genera el worker. */
export const PHOTO_WIDTHS = [400, 800, 1200] as const;

/** Lado mayor al que el navegador reduce la foto antes de subirla. */
export const CLIENT_MAX_SIDE = 1600;

/** Máximo que acepta la URL firmada (una foto de 1600 px en WebP pesa ~200–400 KB). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const UPLOAD_TYPES = ["image/webp", "image/jpeg"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

/** URL pública de una variante: https://img.myfarma.net/r/<reportId>/800.avif */
export function photoUrl(base: string, prefix: string, width: number, ext: "avif" | "webp") {
  return `${base}/${prefix}/${width}.${ext}`;
}

export function photoSrcSet(base: string, prefix: string, ext: "avif" | "webp") {
  return PHOTO_WIDTHS.map((w) => `${photoUrl(base, prefix, w, ext)} ${w}w`).join(", ");
}
