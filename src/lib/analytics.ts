/**
 * Eventos de uso para Umami (sin cookies, sin datos de personas). Si Umami no cargó
 * (desarrollo, bloqueador, "No rastrear"), no hace nada. Solo en componentes de cliente.
 *
 * Eventos: "reporte", "alerta", "ubicacion", "como-llegar", "llamar", "busqueda-sin-resultado".
 */
type Umami = { track: (event: string, data?: Record<string, string | number>) => void };

export function track(event: string, data?: Record<string, string | number>) {
  try {
    (window as unknown as { umami?: Umami }).umami?.track(event, data);
  } catch {
    // La analítica nunca rompe la app.
  }
}

/**
 * Texto de una búsqueda sin resultados, apto para estadísticas: minúsculas, solo letras,
 * números y espacios, máximo 40 caracteres. Sirve para saber qué medicamentos faltan en el catálogo.
 */
export function searchTerm(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}
