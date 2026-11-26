import { describe, expect, it } from "vitest";
import { publicName } from "@/lib/people";
import { parsePrice } from "@/lib/price";
import { safeNext } from "@/lib/redirect";

describe("publicName", () => {
  it.each([
    ["Mariela González", "Mariela G."],
    ["mariela  de  la  ossa", "Mariela O."],
    ["Rubén", "Rubén"],
    ["Ana María Ábrego", "Ana Á."],
    ["Mariela G.", "Mariela G."],
    ["", "Paciente"],
    [null, "Paciente"],
    ["alguien@gmail.com", "Paciente"],
  ])("%s → %s", (input, expected) => {
    expect(publicName(input)).toBe(expected);
  });
});

describe("parsePrice", () => {
  it.each([
    ["15.20", 1520],
    ["15,2", 1520],
    ["B/. 15", 1500],
    ["$7.5", 750],
    ["", null],
    ["  ", null],
  ])("%s → %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });

  it.each(["abc", "15.234", "0.05", "10000", "-3"])("%s no es válido", (input) => {
    expect(parsePrice(input)).toBeNaN();
  });
});

describe("safeNext", () => {
  it.each([
    ["/reportar?med=x", "/reportar?med=x"],
    ["https://malo.com", "/"],
    ["//malo.com", "/"],
    ["/\\malo.com", "/"],
    ["/entrar", "/"],
    ["/api/auth/signout", "/"],
    [undefined, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
