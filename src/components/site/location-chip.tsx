"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useStoredLocationRaw } from "@/lib/location-client";
import { useApplyLocation } from "./use-apply-location";

/** Vista sin interacción para el primer render (Suspense) y antes de hidratar. */
export function LocationChipStatic() {
  return <ChipFace title="Tu zona" value="Elegir ubicación" />;
}

function ChipFace({ title, value, busy }: { title: string; value: string; busy?: boolean }) {
  return (
    <>
      <Icon
        name={busy ? "locate" : "pin"}
        className={`size-4 text-muted ${busy ? "animate-pulse" : ""}`}
      />
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-semibold text-muted">{title}</span>
        <span className="block text-xs font-extrabold">{value}</span>
      </span>
    </>
  );
}

/**
 * "Tu zona" en la barra: sin ubicación guardada, un botón para compartirla;
 * con ubicación, "Cerca de ti" y un menú para actualizarla u olvidarla.
 */
export function LocationChip() {
  const stored = useStoredLocationRaw();
  const { locate, forget, busy, error, clearError } = useApplyLocation();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Cerrar el menú o el aviso al tocar fuera o con Escape.
  useEffect(() => {
    if (!open && !error) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && box.current?.contains(e.target as Node)) return;
      setOpen(false);
      clearError();
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, error, clearError]);

  const onClick = async () => {
    if (stored) return setOpen((o) => !o);
    await locate();
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-expanded={stored ? open : undefined}
        aria-haspopup={stored ? "menu" : undefined}
        className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-surface2 disabled:opacity-70"
      >
        <ChipFace
          title="Tu zona"
          value={busy ? "Ubicando…" : stored ? "Cerca de ti" : "Elegir ubicación"}
          busy={busy}
        />
      </button>

      {open && stored && (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-soft"
        >
          <p className="px-3 pt-2 pb-1 text-[11px] text-muted">
            Guardada solo en este navegador, redondeada a unos 100 m.
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await locate();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-surface2"
          >
            <Icon name="locate" className="size-4 text-brand" />
            Actualizar ubicación
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              forget();
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-surface2"
          >
            <Icon name="x" className="size-4 text-muted" />
            Olvidar ubicación
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="absolute top-full left-0 z-50 mt-2 w-64 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-bad shadow-soft"
        >
          {error}
        </p>
      )}
    </div>
  );
}
