/** Ruta interna segura para volver después de entrar ("/reportar?med=…"). Nunca otro dominio. */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/entrar") || value.startsWith("/api/")) return fallback;
  return value;
}
