"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { tile } from "@/lib/status";
import { deleteAlertAction, setAlertActiveAction, testPushAction } from "./actions";

export type AlertItem = {
  id: string;
  medSlug: string;
  medName: string;
  strength: string;
  color: string;
  placeLabel: string;
  radiusKm: number;
  channels: string[];
  active: boolean;
  nearNow: number;
};

const CHANNEL = { EMAIL: "correo", PUSH: "celular" } as Record<string, string>;

export function AlertList({ alerts }: { alerts: AlertItem[] }) {
  const [items, apply] = useOptimistic(
    alerts,
    (list, change: { id: string; active?: boolean; removed?: boolean }) =>
      change.removed
        ? list.filter((a) => a.id !== change.id)
        : list.map((a) => (a.id === change.id ? { ...a, active: change.active ?? a.active } : a)),
  );
  const [, start] = useTransition();
  const [test, setTest] = useState<string | null>(null);
  const activeCount = items.filter((a) => a.active).length;
  const hasPush = items.some((a) => a.channels.includes("PUSH"));

  return (
    <aside className="rise lg:sticky lg:top-28" style={{ "--d": 2 } as React.CSSProperties}>
      <div className="flex items-end justify-between gap-3">
        <h2 className="h-section">Tus alertas</h2>
        <span className="pill bg-lime text-limeink">
          {activeCount} {activeCount === 1 ? "activa" : "activas"}
        </span>
      </div>
      {items.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((a) => (
            <li
              key={a.id}
              className={`rounded-[1.4rem] bg-surface p-3 shadow-soft transition sm:p-4 ${a.active ? "" : "opacity-60 grayscale"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-tileink ${tile(a.color)}`}
                >
                  <span className="absolute -right-3 -bottom-3 size-8 rounded-full bg-white/35" />
                  <Icon name="bell" className="relative size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/m/${a.medSlug}`}
                        className="font-display text-lg leading-tight font-extrabold hover:underline"
                      >
                        {a.medName}{" "}
                        <span className="font-mono text-sm font-semibold text-muted">
                          {a.strength}
                        </span>
                      </Link>
                      <div className="mt-0.5 text-xs font-medium text-muted">
                        {a.radiusKm} km alrededor de {a.placeLabel} ·{" "}
                        {a.channels.map((c) => CHANNEL[c]).join(", ")}
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-center">
                      <span className="sr-only">Alerta activa</span>
                      <input
                        type="checkbox"
                        checked={a.active}
                        onChange={(e) => {
                          const active = e.target.checked;
                          start(async () => {
                            apply({ id: a.id, active });
                            await setAlertActiveAction(a.id, active);
                          });
                        }}
                        className="peer sr-only"
                      />
                      <span className="switch" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2 text-xs">
                <span
                  className={`inline-flex items-center gap-2 ${a.nearNow ? "font-bold text-ok" : "text-muted"}`}
                >
                  <span
                    className={`relative size-2 rounded-full ${a.nearNow ? "pulse bg-ok text-ok" : "bg-muted/40"}`}
                  />
                  {a.nearNow
                    ? `Hoy hay en ${a.nearNow} ${a.nearNow === 1 ? "sucursal" : "sucursales"} dentro de tu radio`
                    : "Sin existencia en tu radio por ahora"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      apply({ id: a.id, removed: true });
                      await deleteAlertAction(a.id);
                    })
                  }
                  className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-bad/10 hover:text-bad"
                  aria-label={`Eliminar alerta de ${a.medName} ${a.strength}`}
                >
                  <Icon name="trash" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No tienes alertas. Crea una con el formulario.
        </p>
      )}
      {hasPush && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              setTest("Enviando…");
              const r = await testPushAction();
              setTest(
                r.error ??
                  (r.delivered
                    ? "Listo: revisa tus notificaciones."
                    : "No hay ningún dispositivo con avisos activos. Activa «Celular» en el formulario."),
              );
            }}
            className="btn-ghost py-2.5"
          >
            <Icon name="phone" className="size-4" />
            Probar aviso al celular
          </button>
          {test && <span className="text-xs font-semibold text-muted">{test}</span>}
        </div>
      )}
    </aside>
  );
}
