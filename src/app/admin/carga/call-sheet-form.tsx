"use client";

import { useActionState, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { CALL_FIELD, summarizeCall, type CallEntry } from "@/lib/call-sheet";
import { timeAgo } from "@/lib/format";
import { normalize } from "@/lib/text";
import { statusMeta, type Status } from "@/lib/status";
import { saveCallSheetAction, type CallSheetState } from "../actions";

type Row = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  status: Status | null;
  confirmedAt: number | null;
};

const CHOICES: { value: Status; label: string; on: string }[] = [
  { value: "AVAILABLE", label: "Hay", on: "bg-ok text-onstat" },
  { value: "LOW", label: "Pocas", on: "bg-warn text-onstat" },
  { value: "OUT", label: "No hay", on: "bg-bad text-onstat" },
];

export function CallSheetForm({
  medicationId,
  medLabel,
  chainName,
  rows,
  now,
}: {
  medicationId: number;
  medLabel: string;
  chainName: string;
  rows: Row[];
  now: number;
}) {
  const [picks, setPicks] = useState<Record<number, Status>>({});
  const [filter, setFilter] = useState("");
  const [price, setPrice] = useState("");
  const [state, action, pending] = useActionState<CallSheetState, FormData>(
    async (prev, form) => {
      const result = await saveCallSheetAction(prev, form);
      // Guardado: se limpia la planilla (la página ya muestra el estado nuevo de cada sucursal).
      if (result.status === "saved") {
        setPicks({});
        setPrice("");
      }
      return result;
    },
    { status: "idle" },
  );

  const visible = useMemo(() => {
    const q = normalize(filter);
    return q ? rows.filter((r) => normalize(`${r.name} ${r.address}`).includes(q)) : rows;
  }, [rows, filter]);

  const entries: CallEntry[] = Object.entries(picks).map(([id, status]) => ({
    branchId: Number(id),
    status,
  }));
  const anyStock = entries.some((e) => e.status !== "OUT");

  const pick = (id: number, status: Status) =>
    setPicks((p) => {
      const next = { ...p };
      if (next[id] === status) delete next[id];
      else next[id] = status;
      return next;
    });
  const markVisible = (status: Status | null) =>
    setPicks((p) => {
      const next = { ...p };
      for (const r of visible) {
        if (status) next[r.id] = status;
        else delete next[r.id];
      }
      return next;
    });

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="medicationId" value={medicationId} />
      {Object.entries(picks).map(([id, status]) => (
        <input key={id} type="hidden" name={`${CALL_FIELD}${id}`} value={status} />
      ))}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{chainName}</div>
          <h3 className="font-display text-2xl font-extrabold tracking-tight">{medLabel}</h3>
          <p className="text-sm text-muted">
            {rows.length} sucursales. Toca de nuevo una opción para dejar esa sucursal sin cambio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">
            {filter ? "Las que se ven:" : "Todas:"}
          </span>
          {CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => markVisible(c.value)}
              className="chip py-1.5"
            >
              {c.label}
            </button>
          ))}
          <button type="button" onClick={() => markVisible(null)} className="chip py-1.5">
            Limpiar
          </button>
        </div>
      </div>

      <label className="input flex items-center gap-2 py-2.5">
        <Icon name="search" className="size-4 text-muted" />
        <span className="sr-only">Filtrar sucursales</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre o dirección"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
        />
      </label>

      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.6rem] bg-surface shadow-soft">
        {visible.map((r) => {
          const current = statusMeta(r.status);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold">{r.name}</div>
                <div className="truncate text-xs text-muted">
                  {r.address}
                  {r.phone && ` · ${r.phone}`}
                </div>
                <div className="mt-1 text-xs">
                  <span className={`pill ${current.pill}`}>{current.label}</span>
                  {r.confirmedAt && (
                    <span className="ml-2 text-muted">{timeAgo(new Date(r.confirmedAt), now)}</span>
                  )}
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label={`Estado en ${r.name}`}
                className="flex shrink-0 gap-1 rounded-full bg-surface2 p-1"
              >
                {CHOICES.map((c) => {
                  const on = picks[r.id] === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pick(r.id, c.value)}
                      className={`min-h-11 rounded-full px-3.5 text-sm font-bold transition ${on ? c.on : "text-muted hover:bg-surface hover:text-ink"}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
        {!visible.length && (
          <li className="px-4 py-6 text-sm font-semibold text-muted">
            Ninguna sucursal coincide con «{filter}».
          </li>
        )}
      </ul>

      <div className="sticky bottom-24 z-10 flex flex-col gap-3 rounded-[1.6rem] bg-surface p-4 shadow-lift sm:flex-row sm:items-center md:bottom-4">
        <div className="min-w-0 flex-1 text-sm">
          {entries.length ? (
            <b>
              {entries.length} por guardar: {summarizeCall(entries)}
            </b>
          ) : (
            <span className="text-muted">Marca lo que te dijeron en cada sucursal.</span>
          )}
          {state.status === "saved" && !entries.length && (
            <p role="status" className="mt-1 font-semibold text-ok">
              {state.message}
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className="mt-1 font-semibold text-bad">
              {state.message}
            </p>
          )}
        </div>
        {anyStock && (
          <label className="input flex w-full items-center gap-2 py-2.5 sm:w-44">
            <span className="font-mono text-sm font-semibold text-muted">B/.</span>
            <span className="sr-only">Precio (opcional, para las que tienen)</span>
            <input
              name="price"
              inputMode="decimal"
              autoComplete="off"
              placeholder="precio (opc.)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted/70"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending || !entries.length}
          className="btn-primary justify-center disabled:opacity-50"
        >
          <Icon name="check" className="size-4" />
          {pending ? "Guardando…" : `Guardar ${entries.length || ""}`.trim()}
        </button>
      </div>
    </form>
  );
}
