"use client";

import { useApplyLocation } from "@/components/site/use-apply-location";
import { Icon } from "@/components/ui/icon";

/**
 * Pide la ubicación del navegador y la guarda (cookie de este navegador): esta búsqueda y las
 * siguientes se ordenan desde ahí. Si se niega, se queda el punto por defecto.
 */
export function LocateButton({ usingDefault }: { usingDefault: boolean }) {
  const { locate, busy, error } = useApplyLocation();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void locate()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-extrabold shadow-soft transition hover:bg-surface disabled:opacity-60"
      >
        <Icon name="locate" className="size-3.5 text-brand" />
        {busy ? "Ubicando…" : usingDefault ? "Usar mi ubicación" : "Actualizar ubicación"}
      </button>
      {error && (
        <span className="rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold text-bad shadow-soft">
          {error}
        </span>
      )}
    </div>
  );
}
