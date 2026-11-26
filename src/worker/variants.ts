import sharp from "sharp";
import { PHOTO_WIDTHS } from "@/lib/photos";

// Una foto a la vez y sin caché de libvips: el droplet tiene 2 GB compartidos.
sharp.concurrency(1);
sharp.cache(false);

export type Variant = { width: number; ext: "avif" | "webp"; body: Buffer; w: number; h: number };

/**
 * Variantes limpias de una foto: AVIF y WebP en 400, 800 y 1200 px.
 * sharp no copia metadatos a la salida (EXIF, GPS, XMP) salvo que se le pida, y
 * .rotate() aplica antes la orientación del EXIF para que la foto no quede de lado.
 */
export async function renderVariants(original: Buffer): Promise<Variant[]> {
  const opts = { limitInputPixels: 40_000_000, failOn: "error" as const };
  await sharp(original, opts).metadata(); // falla aquí si no es una imagen válida
  const out: Variant[] = [];
  for (const width of PHOTO_WIDTHS) {
    const base = sharp(original, opts)
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true });
    const [webp, avif] = await Promise.all([
      base.clone().webp({ quality: 78 }).toBuffer({ resolveWithObject: true }),
      base.clone().avif({ quality: 50, effort: 4 }).toBuffer({ resolveWithObject: true }),
    ]);
    out.push({ width, ext: "webp", body: webp.data, w: webp.info.width, h: webp.info.height });
    out.push({ width, ext: "avif", body: avif.data, w: avif.info.width, h: avif.info.height });
  }
  return out;
}
