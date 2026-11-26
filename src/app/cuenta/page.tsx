import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { money, timeAgo } from "@/lib/format";
import { publicName } from "@/lib/people";
import { isAvailable, statusMeta } from "@/lib/status";
import { currentUser } from "@/server/auth";
import { getUserReports } from "@/server/services/reports";
import { requestTime } from "@/server/time";
import { doSignOut } from "./actions";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "Tu cuenta", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      <Suspense fallback={<AccountSkeleton />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await currentUser();
  if (!user) redirect("/entrar?next=/cuenta");
  const [reports, now] = await Promise.all([getUserReports(user.id), requestTime()]);

  return (
    <div className="rise flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow">Tu cuenta</div>
          <h1 className="font-display text-4xl font-black tracking-tight">
            Hola, {publicName(user.name).split(" ")[0]}
          </h1>
        </div>
        <form action={doSignOut}>
          <button type="submit" className="btn-ghost py-2.5">
            <Icon name="logout" className="size-4" />
            Salir
          </button>
        </form>
      </header>

      <section className="rounded-[1.6rem] bg-surface p-5 shadow-soft sm:p-6">
        <NameForm name={user.name ?? null} />
      </section>

      <section>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Tus reportes</h2>
          <Link href="/reportar" className="btn-primary py-2.5">
            <Icon name="plus" className="size-4" />
            Reportar
          </Link>
        </div>
        {reports.length ? (
          <ul className="mt-4 flex flex-col gap-2">
            {reports.map((r) => {
              const s = statusMeta(r.status);
              return (
                <li key={r.id}>
                  <Link
                    href={`/m/${r.medSlug}/${r.branchSlug}`}
                    className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft transition hover:shadow-lift sm:p-4"
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${s.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {r.medName} {r.strength}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {r.chainName} {r.branchName} · {timeAgo(r.createdAt, now)}
                        {r.confirmations > 0 &&
                          ` · ${r.confirmations} ${r.confirmations === 1 ? "confirmación" : "confirmaciones"}`}
                        {r.hidden && " · Oculto por moderación"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`pill ${s.pill}`}>{s.label}</span>
                      {r.priceCents != null && isAvailable(r.status) && (
                        <span className="font-mono text-xs">{money(r.priceCents)}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Todavía no has reportado. Cuando vayas a una farmacia, cuéntanos qué encontraste.
          </p>
        )}
      </section>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="skeleton h-14 w-64" />
      <div className="skeleton h-28 rounded-[1.6rem]" />
      <div className="skeleton h-48" />
    </div>
  );
}
