"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { SearchHit } from "@/server/services/catalog";

const DEBOUNCE_MS = 250;
const EXAMPLES = ["metotrexato 2.5 mg", "hidroxicloroquina", "losartán 50 mg", "levotiroxina"];

/** Caché en memoria compartida por todas las instancias: misma consulta → cero peticiones nuevas. */
const memo = new Map<string, SearchHit[]>();

export function SearchBox({
  autoFocus = false,
  size = "lg",
}: {
  autoFocus?: boolean;
  size?: "lg" | "md";
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  // Última respuesta recibida; mientras llega la siguiente se sigue mostrando (sin parpadeo).
  const [last, setLast] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [placeholder, setPlaceholder] = useState("Busca un medicamento");
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  // Derivado en el render: si ya se buscó, sale del caché en memoria sin pedir nada.
  const hits = q.length < 2 ? [] : (memo.get(q) ?? last);

  // Autocompletado con debounce + cancelación de la petición anterior.
  useEffect(() => {
    if (q.length < 2 || memo.has(q)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
        });
        const data = (await res.json()) as { hits: SearchHit[] };
        memo.set(q, data.hits);
        setLast(data.hits);
        setActive(0);
      } catch {
        // cancelada o sin red: se mantiene la lista anterior
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  // Placeholder que se escribe solo (se detiene si el usuario prefiere menos movimiento).
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let word = 0;
    let i = 0;
    let dir = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const input = inputRef.current;
      if (!input || document.activeElement === input || input.value) {
        setPlaceholder("Busca un medicamento");
        timer = setTimeout(tick, 700);
        return;
      }
      const text = EXAMPLES[word]!;
      i += dir;
      setPlaceholder(`Busca ${text.slice(0, i)}${dir === 1 ? "|" : ""}`);
      if (dir === 1 && i >= text.length) {
        dir = -1;
        timer = setTimeout(tick, 1700);
      } else if (dir === -1 && i <= 0) {
        dir = 1;
        word = (word + 1) % EXAMPLES.length;
        timer = setTimeout(tick, 350);
      } else {
        timer = setTimeout(tick, dir === 1 ? 75 : 30);
      }
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, []);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    router.push(`/m/${hit.slug}`);
  };

  const showList = open && query.trim().length >= 2;

  return (
    <form
      role="search"
      className="relative z-20"
      onSubmit={(e) => {
        e.preventDefault();
        go(hits[active] ?? hits[0]);
      }}
    >
      <label htmlFor={`${listId}-q`} className="sr-only">
        Buscar medicamento
      </label>
      <div
        className={`flex items-center gap-2 rounded-full bg-surface pl-3 text-ink shadow-lift transition focus-within:ring-4 focus-within:ring-brand/15 ${
          size === "lg" ? "p-2" : "p-1.5"
        }`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lime text-limeink">
          <Icon name="search" />
        </span>
        <input
          ref={inputRef}
          id={`${listId}-q`}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-activedescendant={showList && hits[active] ? `${listId}-opt-${active}` : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base font-medium outline-none placeholder:text-muted/80"
        />
        <button className="btn-primary shrink-0 px-6" type="submit">
          Buscar
        </button>
      </div>

      {showList && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-lift"
        >
          {hits.length === 0 ? (
            <li className="px-4 py-4 text-sm text-muted">
              {loading ? (
                "Buscando…"
              ) : (
                <>
                  No encontramos “{query.trim()}”. Prueba con el principio activo, por ejemplo{" "}
                  <b className="text-ink">metotrexato</b>.
                </>
              )}
            </li>
          ) : (
            hits.map((hit, i) => (
              <li
                key={hit.slug}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition ${
                  i === active ? "bg-surface2" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-bold">
                    {hit.activeIngredient}{" "}
                    <span className="font-mono text-sm text-brand">{hit.strength}</span>
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {hit.form}
                    {hit.conditionName ? ` · ${hit.conditionName}` : ""}
                  </span>
                </span>
                {hit.scarceInCss && <span className="pill bg-sun/25 text-sunink">Escaso</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
