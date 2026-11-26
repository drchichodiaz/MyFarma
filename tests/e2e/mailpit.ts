import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Espera el correo del enlace mágico en Mailpit y devuelve el enlace. */
export async function magicLink(email: string): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const { messages } = (await res.json()) as { messages: { ID: string }[] };
        if (!messages?.length) return "";
        const msg = (await (
          await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`)
        ).json()) as {
          Text: string;
        };
        link = msg.Text.match(/https?:\/\/\S+\/api\/auth\/callback\/nodemailer\S+/)?.[0] ?? "";
        return link;
      },
      { timeout: 15_000, message: `no llegó el correo a ${email}` },
    )
    .not.toBe("");
  return link;
}

/** Entra con un correo nuevo desde /entrar y vuelve a `next`. */
export async function signInByEmail(page: Page, email: string, next = "/") {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Con tu correo").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
  await page.goto(await magicLink(email));
  await page.waitForURL((url) => url.pathname + url.search === next || url.pathname === next);
}
