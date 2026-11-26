import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInByEmail } from "./mailpit";

/**
 * Sube una foto real a R2 y espera al worker. Necesita las claves R2_PHOTOS_* y `pnpm worker`
 * corriendo, así que solo corre con E2E_PHOTOS=1 (no en el CI).
 */
test.skip(!process.env.E2E_PHOTOS, "Fotos: correr con E2E_PHOTOS=1 y el worker encendido");

const MED = "losartan-50-mg-tabletas";
const BRANCH = "bi-los-pueblos";

test("reporte con foto: se sube, el worker la limpia y se ve sin GPS", async ({ page }) => {
  // Foto de "celular" con GPS en el EXIF.
  const file = join(tmpdir(), `myfarma-gps-${Date.now()}.jpg`);
  await writeFile(
    file,
    await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#7c5" } })
      .jpeg()
      .withExif({
        IFD0: { Make: "Telefono" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "8/1 58/1 4500/100" },
      })
      .toBuffer(),
  );

  await signInByEmail(
    page,
    `e2e-foto-${Date.now()}@myfarma.local`,
    `/reportar?med=${MED}&sucursal=${BRANCH}`,
  );
  await page.waitForLoadState("networkidle"); // que React ya esté escuchando el input
  await page.locator("#photo").setInputFiles(file);
  await expect(page.getByText("Foto lista")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publicar reporte" }).click();
  await expect(page.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();

  // El worker la procesa en segundos y avisa a la app para refrescar la ficha.
  await page.goto(`/m/${MED}/${BRANCH}`);
  const thumb = page.getByRole("button", { name: /^Ver foto/ }).first();
  await expect(async () => {
    await page.reload();
    await expect(thumb).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 45_000 });

  // La variante pública existe, es WebP y no trae metadatos.
  const src = await thumb.locator("img").getAttribute("src");
  expect(src).toMatch(/^https:\/\/img\.myfarma\.net\/r\/[a-z0-9]+\/800\.webp$/);
  const res = await fetch(src!);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toContain("immutable");
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();

  // Se abre grande.
  await thumb.click();
  await expect(page.locator("dialog[open] img")).toBeVisible();
});
