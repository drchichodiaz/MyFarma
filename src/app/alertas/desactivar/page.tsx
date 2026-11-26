import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { checkAlertOffToken, getAlertForOff } from "@/server/services/alerts";
import { connection } from "next/server";
import { deactivateFromEmailAction } from "../actions";

export const metadata: Metadata = { title: "Desactivar alerta", robots: { index: false } };

/**
 * Enlace "Desactivar esta alerta" del correo. Abrir la página no cambia nada (los filtros de
 * correo abren los enlaces solos): hay que tocar el botón.
 */
export default function AlertOffPage({ searchParams }: PageProps<"/alertas/desactivar">) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-5 sm:px-6">
      <section className="rise flex flex-col items-center rounded-[2rem] bg-surface px-6 py-12 text-center shadow-soft">
        <Suspense fallback={<div className="skeleton h-48 w-full" />}>
          <AlertOff searchParams={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}

async function AlertOff({
  searchParams,
}: {
  searchParams: PageProps<"/alertas/desactivar">["searchParams"];
}) {
  await connection();
  const sp = await searchParams;
  const a = typeof sp.a === "string" ? sp.a : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const valid = a && t && checkAlertOffToken(a, t);
  const alert = valid ? await getAlertForOff(a) : null;

  if (!alert) {
    return (
      <>
        <h1 className="font-display text-3xl font-black tracking-tight">Enlace no válido</h1>
        <p className="mt-2 max-w-sm text-muted">
          Puede que la alerta ya no exista. Puedes revisar tus alertas desde tu cuenta.
        </p>
        <Link href="/alertas" className="btn-primary mt-6">
          Ir a mis alertas
        </Link>
      </>
    );
  }

  const name = `${alert.medication.activeIngredient} ${alert.medication.strength}`;
  if (!alert.active) {
    return (
      <>
        <span className="grid size-16 place-items-center rounded-full bg-surface2 text-muted">
          <Icon name="bell" className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-black tracking-tight">Alerta desactivada</h1>
        <p className="mt-2 max-w-sm text-muted">
          Ya no te avisaremos de {name} cerca de {alert.placeLabel}. Puedes volver a activarla
          cuando quieras.
        </p>
        <Link href="/alertas" className="btn-ghost mt-6">
          Ver mis alertas
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="grid size-16 place-items-center rounded-full bg-sun text-[#2b2000]">
        <Icon name="bell" className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-black tracking-tight">¿Desactivar alerta?</h1>
      <p className="mt-2 max-w-sm text-muted">
        Dejaremos de avisarte de <b className="text-ink">{name}</b> a {alert.radiusKm} km de{" "}
        {alert.placeLabel}.
      </p>
      <form action={deactivateFromEmailAction} className="mt-6">
        <input type="hidden" name="a" value={a} />
        <input type="hidden" name="t" value={t} />
        <button type="submit" className="btn-primary">
          Sí, desactivar
        </button>
      </form>
    </>
  );
}
