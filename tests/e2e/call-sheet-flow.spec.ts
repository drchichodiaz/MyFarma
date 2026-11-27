import { expect, test } from "@playwright/test";
import { signInByEmail } from "./mailpit";

/**
 * Carga rápida: el admin marca lo que le dijeron por teléfono en las sucursales de una cadena →
 * se guarda de una vez → la ficha pública lo muestra a nombre de "MyFarma (llamada)".
 */
const MED = "levotiroxina-100-mcg-tabletas";
const CHAIN = "Botica del Istmo";
const BRANCH_NAME = "Los Pueblos";
const BRANCH_SLUG = "bi-los-pueblos";

test("carga rápida: marcar una cadena por llamada y verlo en la ficha", async ({ page }) => {
  test.setTimeout(120_000);

  await signInByEmail(page, "e2e-admin@myfarma.local", "/admin/carga");
  const pick = async (label: string, text: string) => {
    const select = page.getByLabel(label);
    const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
    await select.selectOption(value!);
  };
  await pick("Medicamento", "Levotiroxina 100 mcg");
  await pick("Cadena", CHAIN);
  await page.getByRole("button", { name: "Ver sucursales" }).click();
  await expect(page.getByRole("heading", { name: "Levotiroxina 100 mcg" })).toBeVisible();

  // Todas "No hay" y luego Los Pueblos "Hay", con precio.
  await page.getByRole("button", { name: "No hay", exact: true }).first().click();
  await page
    .getByRole("radiogroup", { name: `Estado en ${BRANCH_NAME}` })
    .getByRole("radio", { name: "Hay", exact: true })
    .click();
  await expect(page.getByText(/por guardar: 1 Hay · \d+ No hay/)).toBeVisible();
  await page.getByPlaceholder("precio (opc.)").fill("12.50");
  await page.getByRole("button", { name: /^Guardar \d+$/ }).click();
  await expect(page.getByRole("status")).toContainText(/Guardados \d+ reportes: 1 Hay/);

  // La ficha pública lo muestra a nombre de MyFarma, con el precio.
  await page.goto(`/m/${MED}/${BRANCH_SLUG}`);
  await expect(page.getByText("MyFarma (llamada)").first()).toBeVisible();
  await expect(page.getByText("B/. 12.50").first()).toBeVisible();
});
