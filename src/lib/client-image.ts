import { CLIENT_MAX_SIDE, type UploadType } from "@/lib/photos";

/**
 * En el navegador: endereza la foto según su EXIF, la reduce a 1600 px y la vuelve a codificar
 * en WebP (JPEG si el navegador no sabe hacer WebP). Pasa de ~4 MB a ~300 KB, y al
 * redibujarla en un canvas ya se pierden los metadatos. El worker igual los quita otra vez.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; type: UploadType }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, CLIENT_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const webp = await toBlob(canvas, "image/webp", 0.82);
    if (webp?.type === "image/webp") return { blob: webp, type: "image/webp" };
    const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
    if (!jpeg) throw new Error("encode");
    return { blob: jpeg, type: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}
