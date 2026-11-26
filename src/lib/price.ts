/**
 * "15.20", "15,20", "B/. 15" → 1520 centavos. Vacío → null. Fuera de rango o mal escrito → NaN.
 * Rango aceptado: B/. 0.10 a B/. 9,999.99.
 */
export function parsePrice(input: string | null | undefined): number | null {
  const raw = (input ?? "").replace(/b\/\.?|\$|\s/gi, "").replace(",", ".");
  if (!raw) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(raw)) return Number.NaN;
  const cents = Math.round(Number(raw) * 100);
  return cents >= 10 && cents <= 999_999 ? cents : Number.NaN;
}
