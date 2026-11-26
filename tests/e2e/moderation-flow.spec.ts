import { expect, test } from "@playwright/test";
import { signInByEmail } from "./mailpit";

/**
 * Moderación: alguien reporta → un admin (ADMIN_EMAILS) lo bloquea y oculta sus reportes →
 * el reporte desaparece de la ficha y esa cuenta ya no puede reportar.
 */
const MED = "enalapril-20-mg-tabletas";
const BRANCH = "bi-el-dorado";
const run = Date.now();
/** Nombre único y solo con letras (el formulario no acepta números): "Spamcbdh…". */
const first =
  "Spam" +
  String(run)
    .slice(-6)
    .replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);

test("bloquear a alguien oculta sus reportes y le impide reportar", async ({ browser }) => {
  test.setTimeout(120_000);

  // 1. Una persona con nombre reconocible reporta.
  const spam = await (await browser.newContext()).newPage();
  await signInByEmail(spam, `e2e-spam-${run}@myfarma.local`, "/cuenta");
  await spam.getByLabel("Tu nombre").fill(`${first} Prueba`);
  await spam.getByRole("button", { name: "Guardar" }).click();
  await expect(spam.getByText("Guardado")).toBeVisible();
  await spam.goto(`/reportar?med=${MED}&sucursal=${BRANCH}`);
  await spam.getByText("No hay", { exact: true }).click();
  await spam.getByRole("button", { name: "Publicar reporte" }).click();
  await expect(spam.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();

  // 2. El admin lo ve en el panel y lo bloquea ocultando todo.
  const admin = await (await browser.newContext()).newPage();
  await signInByEmail(admin, "e2e-admin@myfarma.local", "/admin");
  const row = admin.locator("li", { hasText: `e2e-spam-${run}@myfarma.local` }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Bloquear y ocultar todo" }).click();
  await expect(row.getByText("Oculto")).toBeVisible();

  // 3. Su reporte ya no aparece en la ficha.
  await spam.goto(`/m/${MED}/${BRANCH}`);
  await expect(
    spam.getByText(`${first[0]!.toUpperCase()}${first.slice(1).toLowerCase()} P.`),
  ).toHaveCount(0);

  // 4. Y no puede volver a reportar.
  await spam.goto(`/reportar?med=${MED}&sucursal=${BRANCH}`);
  await spam.getByRole("button", { name: "Publicar reporte" }).click();
  await expect(spam.getByText(/Tu cuenta está suspendida/)).toBeVisible();
});

test("quien no es admin no ve el panel", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Solo para moderadores" })).toBeVisible();
});
