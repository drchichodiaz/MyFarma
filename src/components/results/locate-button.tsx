"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";

/** Pide la ubicación del navegador y la pone en la URL (?lat&lng). Si se niega, se queda el punto por defecto. */
export function LocateButton({ usingDefault }: { usingDefault: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no permite compartir ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params);
        next.set("lat", pos.coords.latitude.toFixed(4));
        next.set("lng", pos.coords.longitude.toFixed(4));
        startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
      },
      () => setError("No pudimos obtener tu ubicación. Seguimos mostrando Vía España."),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={locate}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-extrabold shadow-soft transition hover:bg-surface disabled:opacity-60"
      >
        <Icon name="locate" className="size-3.5 text-brand" />
        {pending ? "Ubicando…" : usingDefault ? "Usar mi ubicación" : "Actualizar ubicación"}
      </button>
      {error && (
        <span className="rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold text-bad shadow-soft">
          {error}
        </span>
      )}
    </div>
  );
}
