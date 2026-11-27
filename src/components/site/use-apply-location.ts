"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { forgetLocation, locateAndSave, LocationError } from "@/lib/location-client";

/**
 * Pedir u olvidar la ubicación y que la página actual se vuelva a ordenar con ella.
 * La ubicación vive en la cookie; si la URL trae lat/lng (un enlace viejo o compartido), se quitan
 * para que mande la cookie.
 */
export function useApplyLocation() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rerender = () => {
    if (params.has("lat") || params.has("lng")) {
      const next = new URLSearchParams(params);
      next.delete("lat");
      next.delete("lng");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    } else {
      startTransition(() => router.refresh());
    }
  };

  const locate = async () => {
    setError(null);
    setLocating(true);
    try {
      await locateAndSave();
      rerender();
      return true;
    } catch (e) {
      setError(e instanceof LocationError ? e.message : "No pudimos obtener tu ubicación.");
      return false;
    } finally {
      setLocating(false);
    }
  };

  const forget = () => {
    setError(null);
    forgetLocation();
    rerender();
  };

  return { locate, forget, busy: locating || pending, error, clearError: () => setError(null) };
}
