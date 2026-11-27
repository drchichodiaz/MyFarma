import { describe, expect, it } from "vitest";
import { scrubEvent, scrubUrl } from "@/lib/sentry-scrub";

describe("scrubUrl", () => {
  it("filtra la ubicación y los tokens, deja lo demás", () => {
    expect(scrubUrl("https://myfarma.net/m/metotrexato?lat=8.99&lng=-79.52&sort=dist")).toBe(
      "https://myfarma.net/m/metotrexato?lat=%5Bfiltrado%5D&lng=%5Bfiltrado%5D&sort=dist",
    );
    expect(scrubUrl("/alertas/desactivar?a=abc&t=secreto#x")).toBe(
      "/alertas/desactivar?a=abc&t=%5Bfiltrado%5D#x",
    );
  });
  it("sin query, igual", () => {
    expect(scrubUrl("https://myfarma.net/")).toBe("https://myfarma.net/");
  });
});

describe("scrubEvent", () => {
  it("quita cookies, cabeceras, usuario y la ubicación de URLs y migas", () => {
    const event = scrubEvent({
      request: {
        url: "https://myfarma.net/m/x?lat=8.9&lng=-79.5",
        query_string: "lat=8.9&lng=-79.5",
        cookies: { "myfarma-loc": "8.9,-79.5" },
        headers: { cookie: "a=b" },
        data: { email: "a@b.c" },
      },
      user: { ip_address: "1.2.3.4" },
      transaction: "/m/x?lat=8.9",
      breadcrumbs: [{ data: { url: "/m/x?lat=8.9", from: "/?lng=1", to: "/a" } }],
    });
    expect(event.request).toEqual({
      url: "https://myfarma.net/m/x?lat=%5Bfiltrado%5D&lng=%5Bfiltrado%5D",
    });
    expect(event.user).toBeUndefined();
    expect(event.transaction).toBe("/m/x?lat=%5Bfiltrado%5D");
    expect(event.breadcrumbs[0]!.data).toEqual({
      url: "/m/x?lat=%5Bfiltrado%5D",
      from: "/?lng=%5Bfiltrado%5D",
      to: "/a",
    });
  });
});
