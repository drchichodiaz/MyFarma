"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { distanceKm, radarPosition } from "@/lib/geo-math";
import { pushSupport, subscribeThisDevice, type PushSupport } from "@/lib/push-client";
import { createAlertAction, savePushAction, type AlertFormState } from "./actions";

type Med = { id: number; slug: string; activeIngredient: string; strength: string; form: string };
type Branch = { id: number; name: string; lat: number; lng: number };
type Place = { label: string; lat: number; lng: number };

const MAX_KM = 10;
const noopSubscribe = () => () => {};

export function AlertForm({
  medications,
  branches,
  available,
  defaultMedId,
  vapidPublicKey,
}: {
  medications: Med[];
  branches: Branch[];
  /** Pares [sucursal, medicamento] con existencia hoy. */
  available: (readonly [number, number])[];
  defaultMedId?: number;
  /** Sin clave, el canal "Celular" no aparece. */
  vapidPublicKey: string | null;
}) {
  const [state, action, pending] = useActionState<AlertFormState, FormData>(createAlertAction, {
    status: "idle",
  });
  const [medId, setMedId] = useState(defaultMedId ?? medications[0]?.id ?? 0);
  const [radius, setRadius] = useState(4);
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  // Capacidad del navegador: en el servidor no se sabe, así que allí vale "unsupported".
  const support = useSyncExternalStore<PushSupport>(
    noopSubscribe,
    pushSupport,
    () => "unsupported",
  );

  // Barrios = nombres de sucursales (una entrada por nombre).
  const places = useMemo(() => {
    const seen = new Map<string, Place>();
    for (const b of branches) {
      if (!seen.has(b.name)) seen.set(b.name, { label: b.name, lat: b.lat, lng: b.lng });
    }
    return [...seen.values()];
  }, [branches]);

  const center = place ?? { ...DEFAULT_LOCATION };
  const availableSet = useMemo(
    () => new Set(available.filter(([, m]) => m === medId).map(([b]) => b)),
    [available, medId],
  );
  const dots = branches
    .map((b) => ({ ...b, km: distanceKm(center, b), has: availableSet.has(b.id) }))
    .filter((b) => b.km <= MAX_KM);
  const inside = dots.filter((d) => d.km <= radius);
  const withStock = inside.filter((d) => d.has).length;

  function locate() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("Tu navegador no permite compartir ubicación. Elige un barrio.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ label: "tu ubicación", lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocError("No pudimos obtener tu ubicación. Elige un barrio de la lista.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }

  async function togglePush(on: boolean) {
    setPushNote(null);
    if (!on) return setPush(false);
    if (!vapidPublicKey) return;
    try {
      const sub = await subscribeThisDevice(vapidPublicKey);
      const saved = await savePushAction(sub);
      if (!saved.ok) throw new Error("save");
      setPush(true);
    } catch (error) {
      setPush(false);
      setPushNote(
        (error as Error).message === "denied"
          ? "Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio."
          : "No pudimos activar los avisos en este dispositivo.",
      );
    }
  }

  const pushBlocked: string | null =
    support === "ios-needs-install"
      ? "En iPhone: toca Compartir → «Agregar a inicio», abre MyFarma desde ese ícono y activa aquí."
      : support === "denied"
        ? "Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio."
        : support === "unsupported"
          ? "Este navegador no permite avisos al celular."
          : null;

  const channels: {
    key: "EMAIL" | "PUSH";
    label: string;
    icon: IconName;
    hint: string;
    tile: string;
    on: boolean;
    set: (v: boolean) => void;
    disabled?: string | null;
  }[] = [
    {
      key: "EMAIL",
      label: "Correo",
      icon: "mail",
      hint: "Recibes la sucursal, el precio y cómo llegar.",
      tile: "bg-tsalmon",
      on: email,
      set: setEmail,
    },
    ...(vapidPublicKey
      ? [
          {
            key: "PUSH" as const,
            label: "Celular",
            icon: "phone" as const,
            hint: "Notificación al instante en este dispositivo.",
            tile: "bg-tblue",
            on: push,
            set: (v: boolean) => void togglePush(v),
            disabled: pushBlocked,
          },
        ]
      : []),
  ];

  return (
    <form
      action={action}
      className="rise flex flex-col gap-7 rounded-[2rem] bg-surface p-5 shadow-soft sm:p-8"
      style={{ "--d": 1 } as React.CSSProperties}
      noValidate
    >
      <input type="hidden" name="lat" value={place?.lat ?? ""} />
      <input type="hidden" name="lng" value={place?.lng ?? ""} />
      <input type="hidden" name="placeLabel" value={place?.label ?? ""} />
      {email && <input type="hidden" name="channels" value="EMAIL" />}
      {push && <input type="hidden" name="channels" value="PUSH" />}

      <div>
        <label htmlFor="medicationId" className="flabel">
          <span className="stepn">1</span>Medicamento
        </label>
        <div className="relative mt-2">
          <select
            id="medicationId"
            name="medicationId"
            value={medId}
            onChange={(e) => setMedId(Number(e.target.value))}
            className="input appearance-none pr-10"
          >
            {medications.map((m) => (
              <option key={m.id} value={m.id}>
                {m.activeIngredient} {m.strength} · {m.form}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">
            <Icon name="chev" className="size-4" />
          </span>
        </div>
      </div>

      <div>
        <div className="flabel">
          <span className="stepn">2</span>¿Cerca de dónde?
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className={`btn-ghost shrink-0 ${place?.label === "tu ubicación" ? "border-brand bg-brand text-brandink hover:bg-brand" : ""}`}
          >
            <Icon name="locate" className="size-4" />
            {locating ? "Ubicando…" : "Mi ubicación"}
          </button>
          <div className="relative flex-1">
            <select
              aria-label="Barrio"
              value={place && place.label !== "tu ubicación" ? place.label : ""}
              onChange={(e) => setPlace(places.find((p) => p.label === e.target.value) ?? null)}
              className="input appearance-none py-3 pr-10"
            >
              <option value="">o elige un barrio…</option>
              {places.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">
              <Icon name="chev" className="size-4" />
            </span>
          </div>
        </div>
        {locError && <p className="mt-2 text-sm font-semibold text-bad">{locError}</p>}
        <p className="mt-2 text-xs text-muted">
          Guardamos el punto redondeado a unos 100 m, nunca tu dirección exacta.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="radiusKm" className="flabel">
            <span className="stepn">3</span>Distancia máxima
          </label>
          <output
            htmlFor="radiusKm"
            className="rounded-full bg-limeink px-3 py-1 font-mono text-sm font-semibold text-lime"
          >
            {radius} km
          </output>
        </div>
        <div className="mt-3 rounded-[1.6rem] bg-tteal p-4 text-tileink sm:p-5">
          <div className="relative mx-auto aspect-square w-full max-w-[280px]" aria-hidden="true">
            {[100, 75, 50, 25].map((p) => (
              <span
                key={p}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50"
                style={{ width: `${p}%`, height: `${p}%` }}
              />
            ))}
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tileink/40 bg-white/35 transition-all duration-500"
              style={{
                width: `${(radius / MAX_KM) * 100}%`,
                height: `${(radius / MAX_KM) * 100}%`,
              }}
            />
            <span className="sweep absolute inset-0" />
            {dots.map((d) => {
              const pos = radarPosition(center, d, MAX_KM);
              const isIn = d.km <= radius;
              return (
                <span
                  key={d.id}
                  className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500 ${
                    isIn
                      ? d.has
                        ? "scale-125 bg-ok ring-2 ring-white"
                        : "bg-tileink/60"
                      : "bg-white/60"
                  }`}
                  style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                />
              );
            })}
            <span className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tileink ring-4 ring-white/70" />
          </div>
          <input
            id="radiusKm"
            name="radiusKm"
            type="range"
            min={1}
            max={MAX_KM}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-4 w-full"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] font-semibold opacity-70">
            <span>1 km</span>
            <span>10 km</span>
          </div>
          <p className="mt-2 text-center text-sm font-semibold">
            {place ? (
              <>
                <b>{inside.length}</b> {inside.length === 1 ? "sucursal" : "sucursales"} en tu radio
                · <b>{withStock}</b> con existencia hoy
              </>
            ) : (
              "Elige tu ubicación o un barrio para ver las sucursales en tu radio."
            )}
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="flabel">
          <span className="stepn">4</span>Cómo quieres que te avisemos
        </legend>
        <div className="mt-3 flex flex-col gap-2">
          {channels.map((c) => (
            <label
              key={c.key}
              className={`flex items-center justify-between gap-4 rounded-2xl bg-surface2 p-3 transition ${c.disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-line/60"}`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${c.tile} text-tileink`}
                >
                  <Icon name={c.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold">{c.label}</span>
                  <span className="block text-xs text-muted">{c.disabled ?? c.hint}</span>
                </span>
              </span>
              <input
                type="checkbox"
                checked={c.on}
                disabled={Boolean(c.disabled)}
                onChange={(e) => c.set(e.target.checked)}
                className="peer sr-only"
              />
              <span className="switch" />
            </label>
          ))}
        </div>
        {pushNote && <p className="mt-2 text-sm font-semibold text-bad">{pushNote}</p>}
      </fieldset>

      {state.status === "error" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad"
        >
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}
      {state.status === "ok" && !pending && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-ok/10 p-3 text-sm font-semibold text-ok"
        >
          <Icon name="check" className="mt-0.5 size-4 shrink-0" />
          Alerta activada. Te avisaremos cuando alguien reporte existencia en tu radio.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !place}
        className="btn-primary justify-center py-4 text-base disabled:opacity-60"
      >
        <Icon name="bell" className="size-5" />
        {pending ? "Activando…" : "Activar alerta"}
      </button>
    </form>
  );
}
