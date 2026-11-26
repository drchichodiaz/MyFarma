import { expect, test } from "@playwright/test";
import { signInByEmail } from "./mailpit";

const MED = "metotrexato-25-mg-ml-inyectable";
const BRANCH = "bi-el-dorado";
const run = Date.now();

test("entrar por correo → reportar → otra persona confirma y el estado cambia", async ({
  browser,
}) => {
  // 1. Sin sesión, /reportar pide entrar y conserva el medicamento y la sucursal.
  const alice = await browser.newContext();
  const page = await alice.newPage();
  await page.goto(`/reportar?med=${MED}&sucursal=${BRANCH}`);
  await expect(page.getByRole("heading", { name: "Entra para reportar" })).toBeVisible();

  // 2. Entra con enlace mágico (Mailpit) y vuelve al formulario.
  await signInByEmail(
    page,
    `e2e-a-${run}@myfarma.local`,
    `/reportar?med=${MED}&sucursal=${BRANCH}`,
  );
  await expect(page.getByLabel("Farmacia y sucursal")).toHaveValue(/\d+/);

  // 3. Reporta "Quedan pocas" con precio.
  await page.getByText("Quedan pocas", { exact: true }).click();
  await page.getByLabel(/Precio/).fill("12,34");
  await expect(page.getByText("B/. 12.34")).toBeVisible(); // vista previa en vivo
  await page.getByRole("button", { name: "Publicar reporte" }).click();
  await expect(page.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();

  // 4. La ficha ya lo muestra (sin esperar a que venza el caché).
  await page.getByRole("link", { name: /^Ver metotrexato/ }).click();
  await page.waitForURL(`**/m/${MED}/${BRANCH}`);
  await expect(page.getByText("Quedan pocas").first()).toBeVisible();
  await expect(page.getByText("B/. 12.34").first()).toBeVisible();
  await expect(page.getByText(/Este es tu reporte/)).toBeVisible();

  // 5. Otra persona dice "Ya no había": el estado pasa a No hay para todos.
  const bob = await browser.newContext();
  const page2 = await bob.newPage();
  await signInByEmail(page2, `e2e-b-${run}@myfarma.local`, `/m/${MED}/${BRANCH}`);
  await page2.getByRole("button", { name: "Ya no había" }).click();
  await expect(page2.getByRole("button", { name: "Ya no había" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page2.getByText("Gracias, tu confirmación ya cuenta.")).toBeVisible();
  await page2.reload();
  await expect(page2.locator("section").getByText("No hay", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator("section").getByText("No hay", { exact: true })).toBeVisible();
  await expect(page.getByText(/No coincidió Paciente/).first()).toBeVisible();

  await alice.close();
  await bob.close();
});

test("sin sesión, la ficha invita a entrar para confirmar", async ({ page }) => {
  await page.goto(`/m/metotrexato-2-5-mg-tabletas/bi-los-pueblos`);
  await expect(page.getByRole("link", { name: /Entra para confirmar/ })).toBeVisible();
});
