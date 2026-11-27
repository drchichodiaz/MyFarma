"use client";

import { reportError } from "@/lib/report-error";
import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/icon";

/** Error inesperado en una página: se ofrece reintentar sin perder el resto del sitio. */
export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 sm:px-6">
      <section className="flex flex-col items-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-soft">
        <span className="grid size-16 place-items-center rounded-full bg-sun/40 text-sunink">
          <Icon name="alert" className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-black tracking-tight">
          {offline ? "Sin conexión" : "Algo falló de nuestro lado"}
        </h1>
        <p className="mt-2 max-w-sm text-muted">
          {offline
            ? "Revisa tu internet y vuelve a intentar."
            : "No es tu culpa. Intenta de nuevo; si sigue fallando, escríbenos a hola@myfarma.net."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="btn-primary">
            Intentar de nuevo
          </button>
          <Link href="/" className="btn-ghost">
            Ir al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
