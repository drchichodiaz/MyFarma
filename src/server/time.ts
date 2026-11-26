import "server-only";
import { connection } from "next/server";

/**
 * Hora de la petición actual, para "hace 45 min" y la frescura de los datos.
 * Llama a connection(): el componente que la use se renderiza por petición, nunca en el build.
 */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
