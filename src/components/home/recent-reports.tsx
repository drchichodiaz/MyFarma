import { requestTime } from "@/server/time";
import Link from "next/link";
import { initials, timeAgo } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import { getRecentReports } from "@/server/services/availability";

/** "En vivo": últimos reportes de la comunidad. Se renderiza por petición (horas relativas). */
export async function RecentReports() {
  const reports = await getRecentReports(5);
  const now = await requestTime();
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {reports.map((r) => {
        const s = statusMeta(r.status);
        return (
          <li key={r.id}>
            <Link
              href={`/m/${r.medSlug}/${r.branchSlug}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 pr-4 shadow-soft transition hover:border-brand/40 hover:shadow-lift"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface2 text-sm font-extrabold text-muted">
                {initials(r.who)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  <b>{r.who}</b> <span className="text-muted">reportó</span>{" "}
                  <b>
                    {r.medName} {r.strength}
                  </b>
                </span>
                <span className="block truncate text-xs text-muted">
                  {r.chainName} · {r.branchName} · {timeAgo(r.createdAt, now)}
                </span>
              </span>
              <span className={`pill ${s.pill}`}>{s.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RecentReportsSkeleton() {
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}
