import Link from "next/link";
import { Suspense } from "react";
import { ReportPhoto } from "@/components/results/report-photo";
import { Icon } from "@/components/ui/icon";
import { env } from "@/lib/env";
import { money, timeAgo } from "@/lib/format";
import { isAvailable, statusMeta } from "@/lib/status";
import { adminStats, listReports, requireAdmin, type ReportFilter } from "@/server/services/admin";
import { requestTime } from "@/server/time";
import { hideReportPhotoAction, setReportHiddenAction, setUserBlockedAction } from "./actions";
import { NoAdmin } from "./no-admin";

const FILTERS: { key: ReportFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "fotos", label: "Con foto" },
  { key: "ocultos", label: "Ocultos" },
];

export default function AdminReportsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-[2rem]" />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const [admin, sp] = await Promise.all([requireAdmin(), searchParams]);
  if (!admin) return <NoAdmin />;

  const filter = FILTERS.find((f) => f.key === sp.ver)?.key ?? "todos";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const [stats, { reports, nextCursor }, now] = await Promise.all([
    adminStats(),
    listReports(filter, cursor),
    requestTime(),
  ]);

  const tiles: [string, number][] = [
    ["Reportes hoy", stats.reportsToday],
    ["Reportes 7 días", stats.reportsWeek],
    ["Cuentas nuevas 7 días", stats.usersWeek],
    ["Alertas activas", stats.activeAlerts],
    ["Fotos en proceso", stats.pendingPhotos],
    ["Reportes ocultos", stats.hidden],
    ["Cuentas bloqueadas", stats.blocked],
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface p-3 shadow-soft">
            <dd className="font-display text-3xl font-black tabular-nums">{value}</dd>
            <dt className="text-xs font-semibold text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "todos" ? "/admin" : `/admin?ver=${f.key}`}
            className={`chip ${filter === f.key ? "chip-on" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {reports.length ? (
        <ul className="flex flex-col gap-2">
          {reports.map((r) => {
            const s = statusMeta(r.status);
            return (
              <li
                key={r.id}
                className={`rounded-2xl bg-surface p-4 shadow-soft ${r.hidden ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`pill ${s.pill}`}>{s.label}</span>
                      {r.priceCents != null && isAvailable(r.status) && (
                        <span className="font-mono text-xs">{money(r.priceCents)}</span>
                      )}
                      {r.hidden && <span className="pill bg-bad/10 text-bad">Oculto</span>}
                      {r.photoStatus && r.photoStatus !== "READY" && (
                        <span className="pill bg-surface2 text-muted">Foto: {r.photoStatus}</span>
                      )}
                    </div>
                    <Link
                      href={`/m/${r.medSlug}/${r.branchSlug}`}
                      className="mt-1 block font-bold hover:underline"
                    >
                      {r.medName} {r.strength} · {r.branchLabel}
                    </Link>
                    <div className="text-xs text-muted">
                      {timeAgo(r.createdAt, now)} ·{" "}
                      {r.source === "CALL" && <b className="text-brand">Llamada · </b>}
                      {r.userName ?? "Sin nombre"}{" "}
                      <span className="font-mono">{r.userEmail ?? "—"}</span>
                      {r.userBlocked && <b className="text-bad"> · bloqueado</b>} ·{" "}
                      {r.confirmations} sí / {r.disagreements} no
                    </div>
                    {r.photoStatus === "READY" && r.photoKey && r.photoWidth && r.photoHeight && (
                      <ReportPhoto
                        photo={{
                          base: env.PHOTOS_PUBLIC_URL,
                          prefix: r.photoKey,
                          width: r.photoWidth,
                          height: r.photoHeight,
                        }}
                        alt={`Foto del reporte de ${r.medName}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={setReportHiddenAction}>
                      <input type="hidden" name="reportId" value={r.id} />
                      <input type="hidden" name="hidden" value={r.hidden ? "0" : "1"} />
                      <button className="btn-ghost py-2 text-xs">
                        <Icon name={r.hidden ? "check" : "x"} className="size-3.5" />
                        {r.hidden ? "Mostrar" : "Ocultar reporte"}
                      </button>
                    </form>
                    {r.photoStatus === "READY" && (
                      <form action={hideReportPhotoAction}>
                        <input type="hidden" name="reportId" value={r.id} />
                        <button className="btn-ghost py-2 text-xs">
                          <Icon name="camera" className="size-3.5" />
                          Quitar foto
                        </button>
                      </form>
                    )}
                    {r.userId && !r.userBlocked && r.userId !== admin.id && (
                      <form action={setUserBlockedAction}>
                        <input type="hidden" name="userId" value={r.userId} />
                        <input type="hidden" name="blocked" value="1" />
                        <input type="hidden" name="hideReports" value="1" />
                        <button className="btn-ghost py-2 text-xs text-bad">
                          <Icon name="shield" className="size-3.5" />
                          Bloquear y ocultar todo
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No hay reportes en esta vista.
        </p>
      )}

      <div className="flex gap-3">
        {cursor && (
          <Link href={filter === "todos" ? "/admin" : `/admin?ver=${filter}`} className="btn-ghost">
            Más recientes
          </Link>
        )}
        {nextCursor && (
          <Link href={`/admin?ver=${filter}&cursor=${nextCursor}`} className="btn-ghost">
            Más antiguos
          </Link>
        )}
      </div>
    </div>
  );
}
