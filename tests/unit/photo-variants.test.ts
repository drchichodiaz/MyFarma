import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderVariants } from "@/worker/variants";

/** Foto de 2000×1000 con GPS (Ciudad de Panamá) y orientación 6 (girada 90°), como sale de un celular. */
async function phonePhoto() {
  return sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#4a9" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "Telefono", Model: "Prueba" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "8/1 58/1 4500/100",
        GPSLongitudeRef: "W",
        GPSLongitude: "79/1 31/1 1200/100",
      },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

/** ¿El EXIF trae el puntero al bloque GPS (etiqueta 0x8825)? */
const hasGpsIfd = (exif: Buffer | undefined) =>
  !!exif && (exif.includes(Buffer.from([0x25, 0x88])) || exif.includes(Buffer.from([0x88, 0x25])));

describe("renderVariants", () => {
  it("la foto de prueba sí trae GPS (si no, el test no prueba nada)", async () => {
    const meta = await sharp(await phonePhoto()).metadata();
    expect(meta.exif?.toString("latin1")).toContain("Telefono");
    expect(hasGpsIfd(meta.exif)).toBe(true);
    expect(meta.orientation).toBe(6);
  });

  it("ninguna variante conserva EXIF, GPS ni XMP", async () => {
    const variants = await renderVariants(await phonePhoto());
    expect(variants).toHaveLength(6);
    for (const v of variants) {
      const meta = await sharp(v.body).metadata();
      expect(meta.exif, `${v.width}.${v.ext}`).toBeUndefined();
      expect(meta.xmp, `${v.width}.${v.ext}`).toBeUndefined();
      expect(v.body.toString("latin1")).not.toContain("Telefono");
      expect(meta.format).toBe(v.ext === "avif" ? "heif" : "webp");
    }
  });

  it("endereza la foto según el EXIF y respeta los anchos", async () => {
    const variants = await renderVariants(await phonePhoto());
    const big = variants.find((v) => v.width === 1200 && v.ext === "webp")!;
    // 2000×1000 girada 90° → vertical 1000×2000 → cabe en 1200: 600×1200
    expect([big.w, big.h]).toEqual([600, 1200]);
    const small = variants.find((v) => v.width === 400 && v.ext === "avif")!;
    expect(Math.max(small.w, small.h)).toBe(400);
  });

  it("rechaza lo que no es una imagen", async () => {
    await expect(renderVariants(Buffer.from("no soy una foto"))).rejects.toThrow();
  });
});
