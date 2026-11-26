/**
 * Nombre que se muestra en público: nombre + inicial del apellido ("Mariela G.").
 * Nunca el correo ni el apellido completo. Sin nombre, "Paciente".
 */
export function publicName(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length || words[0]!.includes("@")) return "Paciente";
  const first = capitalize(words[0]!);
  if (words.length === 1) return first;
  const initial = words
    .at(-1)!
    .replace(/[^\p{L}]/gu, "")
    .charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}
