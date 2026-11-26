import Link from "next/link";
import { ChainBadge } from "@/components/med/chain-badge";
import { Icon } from "@/components/ui/icon";
import { freshness, km, money, timeAgo } from "@/lib/format";
import { isAvailable, statusMeta } from "@/lib/status";
import type { NearbyBranch } from "@/server/services/availability";

export function BranchCard({
  branch: b,
  medSlug,
  now,
  index,
}: {
  branch: NearbyBranch;
  medSlug: string;
  now: number;
  index: number;
}) {
  const s = statusMeta(b.status);
  const ok = isAvailable(b.status);
  const fresh = b.confirmedAt ? freshness(b.confirmedAt, now) : null;
  return (
    <Link
      href={`/m/${medSlug}/${b.branchSlug}`}
      className="rise group block rounded-[1.4rem] bg-surface p-3 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-4"
      style={{ "--d": Math.min(index, 8) + 2 } as React.CSSProperties}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <ChainBadge name={b.chainName} color={b.chainColor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-muted">{b.chainName}</div>
              <div className="font-display text-xl leading-tight font-extrabold tracking-tight">
                {b.name}
              </div>
            </div>
            <span className={`pill shrink-0 ${s.pill}`}>
              <Icon name={s.icon} className="size-3.5" />
              {s.label}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" className="size-3.5" />
              <span className="tabular-nums">{km(b.meters)}</span>
            </span>
            {b.hours && <span>{b.hours}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted">
          <span
            className={`size-2 shrink-0 rounded-full ${fresh === "fresh" ? "pulse bg-ok text-ok" : "bg-muted/40"}`}
          />
          <span className="truncate">
            {b.confirmedAt
              ? `Confirmado ${timeAgo(b.confirmedAt, now)}${b.confirmations ? ` · ${b.confirmations} ${b.confirmations === 1 ? "persona" : "personas"}` : ""}`
              : "Nadie ha reportado esta sucursal"}
            {fresh === "aging" || fresh === "stale" ? " · puede haber cambiado" : ""}
          </span>
        </span>
        <span
          className={`font-mono text-base font-semibold tabular-nums ${ok && b.priceCents ? "" : "text-muted"}`}
        >
          {ok ? money(b.priceCents) : "—"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className={`text-xs font-semibold ${ok ? s.text : "text-muted"}`}>{s.hint}</span>
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold transition group-hover:bg-ink group-hover:text-bg">
          Ver detalle <Icon name="arrow" className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
