/** B/. 15.20 a partir de centavos. */
export function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `B/. ${(cents / 100).toFixed(2)}`;
}

/** "hace 45 min", "hace 3 h", "hace 2 días". `now` se pasa explícito para que el render sea determinista. */
export function timeAgo(date: Date | string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "justo ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

/** Versión corta para cifras grandes: "45 min", "3 h", "2 d". */
export function timeAgoShort(date: Date | string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export type Freshness = "fresh" | "today" | "aging" | "stale";

/** Frescura de un dato (ver PLAN.md → Reglas de disponibilidad). */
export function freshness(date: Date | string, now: number): Freshness {
  const hours = (now - new Date(date).getTime()) / 3_600_000;
  if (hours < 3) return "fresh";
  if (hours < 24) return "today";
  if (hours < 72) return "aging";
  return "stale";
}

export function km(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function initials(name: string): string {
  return (name.match(/\p{Lu}/gu) ?? [name[0] ?? "?"]).join("").slice(0, 2);
}
