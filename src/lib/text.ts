/** Minúsculas y sin acentos: "Losartán" → "losartan". Igual en el seed, la búsqueda y el cliente. */
export function normalize(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
