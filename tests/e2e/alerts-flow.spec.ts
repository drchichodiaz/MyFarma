import { expect, test } from "@playwright/test";
import { signInByEmail } from "./mailpit";

/**
 * Alertas de punta a punta. Necesita el worker (`pnpm worker`), que en el CI corre aparte.
 * B crea una alerta → A reporta "Hay" en una sucursal dentro del radio → a B le llega el correo
 * → B la desactiva desde el enlace del correo.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
const MED = "levotiroxina-100-mcg-tabletas";
const BRANCH_SLUG = "bi-los-pueblos";
const PLACE = "Los Pueblos";
const run = Date.now();

async function alertEmail(to: string) {
  let found: { subject: string; text: string } | null = null;
  await expect
    .poll(
      async () => {
        const q = encodeURIComponent(`to:${to} subject:"Hay"`);
        const { messages } = (await (
          await fetch(`${MAILPIT}/api/v1/search?query=${q}`)
        ).json()) as {
          messages: { ID: string; Subject: string }[];
        };
        if (!messages?.length) return false;
        const m = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)).json()) as {
          Subject: string;
          Text: string;
        };
        found = { subject: m.Subject, text: m.Text };
        return true;
      },
      { timeout: 30_000, message: `no llegó la alerta a ${to}` },
    )
    .toBe(true);
  return found!;
}

test("alerta: crear → reporte dentro del radio → llega el correo → desactivar", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const bobEmail = `e2e-alerta-${run}@myfarma.local`;

  // 1. B crea una alerta de levotiroxina a 3 km de Los Pueblos, por correo.
  const bob = await (await browser.newContext()).newPage();
  await signInByEmail(bob, bobEmail, `/alertas?med=${MED}`);
  await bob.waitForLoadState("networkidle");
  await bob.getByLabel("Barrio").selectOption(PLACE);
  await bob.getByLabel(/Distancia máxima/).fill("3");
  await expect(bob.getByText(/sucursal(es)? en tu radio/)).toBeVisible();
  await bob.getByRole("button", { name: "Activar alerta" }).click();
  await expect(bob.getByText("Alerta activada.")).toBeVisible();
  await expect(bob.getByText(`3 km alrededor de ${PLACE}`)).toBeVisible();

  // 2. A reporta "Hay" en esa sucursal.
  const alice = await (await browser.newContext()).newPage();
  await signInByEmail(
    alice,
    `e2e-reporta-${run}@myfarma.local`,
    `/reportar?med=${MED}&sucursal=${BRANCH_SLUG}`,
  );
  await alice.getByRole("button", { name: "Publicar reporte" }).click();
  await expect(alice.getByRole("heading", { name: "¡Gracias!" })).toBeVisible();

  // 3. A B le llega el correo de alerta, con el enlace para desactivarla.
  const mail = await alertEmail(bobEmail);
  expect(mail.subject).toMatch(/^Hay: Levotiroxina 100 mcg en .*Los Pueblos$/i);
  const off = mail.text.match(/https?:\/\/\S+\/alertas\/desactivar\?\S+/)?.[0];
  expect(off).toBeTruthy();

  // 4. Abrir el enlace no desactiva nada; el botón sí (aunque no haya sesión).
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(new URL(off!).pathname + new URL(off!).search);
  await expect(anon.getByRole("heading", { name: "¿Desactivar alerta?" })).toBeVisible();
  await anon.getByRole("button", { name: "Sí, desactivar" }).click();
  await expect(anon.getByRole("heading", { name: "Alerta desactivada" })).toBeVisible();

  // 5. En la cuenta de B aparece pausada.
  await bob.reload();
  await expect(bob.getByRole("checkbox", { name: "Alerta activa" }).first()).not.toBeChecked();
});

test("sin sesión, /alertas pide entrar", async ({ page }) => {
  await page.goto("/alertas");
  await expect(page.getByRole("heading", { name: "Entra para crear alertas" })).toBeVisible();
});

test("enlace de baja alterado no sirve", async ({ page }) => {
  await page.goto("/alertas/desactivar?a=noexiste&t=falso");
  await expect(page.getByRole("heading", { name: "Enlace no válido" })).toBeVisible();
});
