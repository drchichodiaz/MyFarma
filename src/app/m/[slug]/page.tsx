import { requestTime } from "@/server/time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MedBox } from "@/components/med/med-box";
import { BranchCard } from "@/components/results/branch-card";
import { LazyMap } from "@/components/results/lazy-map";
import { LocateButton } from "@/components/results/locate-button";
import type { MapPoint } from "@/components/results/results-map";
import { Icon } from "@/components/ui/icon";
import { money, timeAgoShort } from "@/lib/format";
import { parseLocation } from "@/lib/geo";
import { STATUS, isAvailable, type Status } from "@/lib/status";
import { getNearbyAvailability, type NearbyBranch } from "@/server/services/availability";
import { getAllMedications, getMedication } from "@/server/services/catalog";
import { MedSwitcher, ResultsSkeleton } from "./parts";

type SearchParams = Record<string, string | string[] | undefined>;
const SORTS = [
  ["dist", "Cercanía"],
  ["price", "Precio"],
  ["recent", "Reciente"],
] as const;

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const med = await getMedication((await params).slug);
  if (!med) return { title: "Medicamento no encontrado" };
  return {
    title: `¿Dónde hay ${med.activeIngredient} ${med.strength}?`,
    description: `Farmacias en Panamá con ${med.activeIngredient} ${med.strength} (${med.form.toLowerCase()}): existencia, precio y última confirmación.`,
  };
}

export default function MedicationPage({ params, searchParams }: PageProps<"/m/[slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <Suspense fallback={<div className="skeleton h-11 rounded-full" />}>
        <MedSwitcherSection params={params} />
      </Suspense>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function MedSwitcherSection({ params }: { params: Promise<{ slug: string }> }) {
  // Primero params: así este bloque nunca se prerenderiza en el build (no toca la DB).
  // La lista sale de "use cache", por lo que esperar params antes no cuesta nada.
  const { slug } = await params;
  const meds = await getAllMedications();
  return <MedSwitcher meds={meds} current={slug} />;
}

function sortRows(rows: NearbyBranch[], sort: string) {
  const big = Number.MAX_SAFE_INTEGER;
  const copy = [...rows];
  if (sort === "price")
    copy.sort(
      (a, b) =>
        ((isAvailable(a.status) && a.priceCents) || big) -
        ((isAvailable(b.status) && b.priceCents) || big),
    );
  else if (sort === "recent")
    copy.sort(
      (a, b) =>
        (b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0) -
        (a.confirmedAt ? new Date(a.confirmedAt).getTime() : 0),
    );
  return copy; // "dist": ya viene ordenado por distancia desde SQL
}

async function Results({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const med = await getMedication(slug);
  if (!med) notFound();

  const here = parseLocation(sp);
  const all = await getNearbyAvailability(med.id, here.lat, here.lng);
  const now = await requestTime();

  const sort = SORTS.some(([k]) => k === sp.sort) ? String(sp.sort) : "dist";
  const onlyStock = sp.stock === "1";
  const freshOnly = sp.fresh === "1";
  const rows = sortRows(
    all.filter(
      (r) =>
        (!onlyStock || isAvailable(r.status)) &&
        (!freshOnly || (r.confirmedAt && now - new Date(r.confirmedAt).getTime() < 86_400_000)),
    ),
    sort,
  );

  const count = (s: Status | null) => all.filter((r) => r.status === s).length;
  const available = all.filter((r) => isAvailable(r.status));
  const minPrice = available.reduce<number | null>(
    (min, r) => (r.priceCents != null && (min == null || r.priceCents < min) ? r.priceCents : min),
    null,
  );
  const lastConfirmed = all.reduce<number | null>((max, r) => {
    const t = r.confirmedAt ? new Date(r.confirmedAt).getTime() : null;
    return t != null && (max == null || t > max) ? t : max;
  }, null);

  /** Enlace que conserva ubicación y filtros, cambiando solo lo indicado. */
  const href = (change: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...change }))
      if (typeof v === "string" && v && v !== "0") next.set(k, v);
    const qs = next.toString();
    return qs ? `/m/${slug}?${qs}` : `/m/${slug}`;
  };

  const points: MapPoint[] = all.map((r) => ({
    slug: r.branchSlug,
    name: r.name,
    chainName: r.chainName,
    lat: r.lat,
    lng: r.lng,
    status: r.status,
    label: isAvailable(r.status)
      ? r.priceCents
        ? money(r.priceCents)
        : STATUS[r.status!].label
      : r.status === "OUT"
        ? "No hay"
        : "?",
  }));

  const segments: (Status | null)[] = ["AVAILABLE", "LOW", "OUT", null];

  return (
    <>
      <section className="rise relative mt-3 overflow-hidden rounded-[2rem] bg-lime p-5 text-limeink sm:p-8">
        <div
          className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full border-[36px] border-white/25"
          aria-hidden="true"
        />
        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {med.scarceInCss && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-limeink px-3 py-1.5 text-lime">
                  <Icon name="alert" className="size-3.5" />
                  Escasez en la CSS
                </span>
              )}
              {med.conditionName && (
                <span className="rounded-full bg-white/50 px-3 py-1.5">{med.conditionName}</span>
              )}
            </div>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,8vw,5.6rem)] leading-[.9] font-black tracking-[-0.045em] break-words">
              {med.activeIngredient}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-limeink px-4 py-1.5 font-mono text-lg font-semibold text-lime">
                {med.strength}
              </span>
              <span className="rounded-full bg-white/50 px-3 py-1.5 font-mono text-xs font-semibold">
                {med.form}
                {med.pack ? ` · ${med.pack}` : ""}
              </span>
              {med.requiresRx && (
                <span className="rounded-full bg-white/50 px-3 py-1.5 font-mono text-xs font-semibold">
                  <b className="text-bad">Rx</b> Requiere receta
                </span>
              )}
            </div>
          </div>
          <div className="hidden -rotate-6 transition duration-500 hover:rotate-0 md:block">
            <MedBox {...med} />
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            [
              <>
                {available.length}
                <span className="text-lg text-muted">/{all.length}</span>
              </>,
              "sucursales con existencia",
            ],
            [minPrice != null ? (minPrice / 100).toFixed(2) : "—", "precio más bajo, en B/."],
            [
              lastConfirmed ? timeAgoShort(new Date(lastConfirmed), now) : "—",
              "desde el último reporte",
            ],
          ].map(([value, label], i) => (
            <div key={i} className="rounded-2xl bg-surface p-3 text-ink shadow-soft sm:p-4">
              <div className="font-display text-3xl font-black tabular-nums sm:text-4xl">
                {value}
              </div>
              <div className="mt-1 text-[11px] leading-tight font-semibold text-muted sm:text-xs">
                {label}
              </div>
            </div>
          ))}
        </div>

        {all.length > 0 && (
          <>
            <div
              className="relative mt-4 flex h-3 w-full gap-1 overflow-hidden rounded-full bg-white/40 p-0.5"
              aria-hidden="true"
            >
              {segments
                .filter((s) => count(s))
                .map((s, i) => (
                  <span
                    key={s ?? "none"}
                    className={`grow-bar rounded-full ${STATUS[s ?? "NONE"].dot}`}
                    style={{
                      width: `${(count(s) / all.length) * 100}%`,
                      animationDelay: `${250 + i * 120}ms`,
                    }}
                  />
                ))}
            </div>
            <div className="relative mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
              {segments.map((s) => (
                <span key={s ?? "none"} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${STATUS[s ?? "NONE"].dot}`} />
                  {count(s)} {STATUS[s ?? "NONE"].label.toLowerCase()}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="h-section">¿Dónde hay?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={href({ stock: onlyStock ? null : "1" })}
              scroll={false}
              className={`chip ${onlyStock ? "chip-on" : ""}`}
              aria-pressed={onlyStock}
            >
              <Icon name="check" className="size-4" />
              Solo con existencia
            </Link>
            <Link
              href={href({ fresh: freshOnly ? null : "1" })}
              scroll={false}
              className={`chip ${freshOnly ? "chip-on" : ""}`}
              aria-pressed={freshOnly}
            >
              <Icon name="clock" className="size-4" />
              Confirmado en 24 h
            </Link>
          </div>
        </div>
        <nav
          className="inline-flex rounded-full bg-surface p-1 text-sm font-bold shadow-soft"
          aria-label="Ordenar por"
        >
          {SORTS.map(([key, label]) => (
            <Link
              key={key}
              href={href({ sort: key === "dist" ? null : key })}
              scroll={false}
              aria-current={sort === key ? "true" : undefined}
              className={`rounded-full px-3.5 py-1.5 transition ${sort === key ? "bg-lime text-limeink" : "text-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="order-2 flex flex-col gap-3 lg:order-1">
          {rows.length ? (
            rows.map((r, i) => (
              <BranchCard key={r.branchId} branch={r} medSlug={slug} now={now} index={i} />
            ))
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted">
              Ninguna sucursal cercana cumple esos filtros.{" "}
              <Link
                href={href({ stock: null, fresh: null })}
                className="font-bold text-brand underline"
              >
                Quitar filtros
              </Link>
            </div>
          )}
          <Link
            href="/alertas"
            className="group relative mt-2 overflow-hidden rounded-[1.4rem] bg-sun p-5 text-[#2b2000] transition hover:-translate-y-1 hover:shadow-lift"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2b2000] px-3 py-1 text-[11px] font-extrabold text-sun">
              <Icon name="bell" className="size-3.5" />
              Alertas
            </span>
            <span className="mt-2 block max-w-[16rem] font-display text-2xl leading-tight font-extrabold">
              ¿No te queda cerca? Te avisamos.
            </span>
            <span className="mt-1 block max-w-[18rem] text-sm font-medium opacity-80">
              Cuando alguien reporte {med.activeIngredient.toLowerCase()} {med.strength} en tu zona.
            </span>
            <span className="tile-ic absolute -right-2 -bottom-3 text-[#2b2000]/85">
              <Icon name="bell" className="size-24" />
            </span>
          </Link>
        </div>

        <div className="order-1 lg:sticky lg:top-28 lg:order-2">
          <div className="overflow-hidden rounded-[2rem] bg-surface p-2 shadow-soft">
            <div className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-[1.6rem]">
              <LazyMap points={points} center={[here.lat, here.lng]} medSlug={slug} />
              <div className="absolute top-3 left-3 z-[500] flex flex-col items-start gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-xs font-extrabold shadow-soft">
                  <Icon name="pin" className="size-3.5 text-brand" />
                  Cerca de {here.label}
                </span>
                <LocateButton usingDefault={here.isDefault} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pt-3 pb-1.5 text-xs font-semibold text-muted">
              {(["AVAILABLE", "LOW", "OUT"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${STATUS[s].dot}`} />
                  {STATUS[s].label}
                </span>
              ))}
              <span className="ml-auto">Radio de 15 km</span>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted">
            <Icon name="alert" className="size-4 shrink-0" />
            La existencia cambia durante el día. Llama a la sucursal antes de ir.
          </p>
        </div>
      </div>
    </>
  );
}
