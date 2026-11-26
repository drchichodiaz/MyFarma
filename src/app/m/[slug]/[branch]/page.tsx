import { requestTime } from "@/server/time";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChainBadge } from "@/components/med/chain-badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { money, timeAgo } from "@/lib/format";
import { isAvailable, statusMeta } from "@/lib/status";
import { ConfirmBox } from "@/components/results/confirm-box";
import type { Status } from "@/lib/status";
import { currentUser } from "@/server/auth";
import { getBranch, getBranchMedication, getMyVote } from "@/server/services/availability";
import { getMedication } from "@/server/services/catalog";

type Params = Promise<{ slug: string; branch: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, branch } = await params;
  const [med, b] = await Promise.all([getMedication(slug), getBranch(branch)]);
  if (!med || !b) return { title: "No encontrado" };
  return { title: `${med.activeIngredient} ${med.strength} en ${b.chainName} ${b.name}` };
}

export default function BranchPage({ params, searchParams }: PageProps<"/m/[slug]/[branch]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      <Suspense fallback={<BranchSkeleton />}>
        <BranchDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function BranchDetail({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug, branch: branchSlug }, sp] = await Promise.all([params, searchParams]);
  const [med, branch] = await Promise.all([getMedication(slug), getBranch(branchSlug)]);
  if (!med || !branch) notFound();

  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const { availability, reports, nextCursor } = await getBranchMedication(
    branch.id,
    med.id,
    cursor,
  );
  const now = await requestTime();
  const s = statusMeta(availability?.status);
  const directions = `https://www.google.com/maps/search/?api=1&query=${branch.lat},${branch.lng}`;

  return (
    <article className="rise">
      <Link
        href={`/m/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="back" className="size-4" />
        {med.activeIngredient} {med.strength}
      </Link>

      <header className="mt-4 flex items-start gap-4">
        <ChainBadge name={branch.chainName} color={branch.chainColor} className="size-16 text-lg" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-muted">{branch.chainName}</div>
          <h1 className="font-display text-4xl leading-tight font-black tracking-tight">
            {branch.name}
          </h1>
          <p className="mt-1 text-sm text-muted">{branch.address}</p>
        </div>
      </header>

      <section className={`mt-6 rounded-[1.6rem] p-6 ${s.panel}`}>
        <div className={`text-xs font-extrabold tracking-[.14em] uppercase ${s.text}`}>
          {med.activeIngredient} {med.strength} · {med.form}
        </div>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div className={`font-display text-4xl font-black ${s.text}`}>{s.label}</div>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {availability && isAvailable(availability.status) ? money(availability.priceCents) : ""}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          {availability
            ? `Confirmado ${timeAgo(availability.confirmedAt, now)} · ${availability.confirmations} ${availability.confirmations === 1 ? "persona" : "personas"}`
            : "Todavía nadie ha reportado este medicamento en esta sucursal."}
        </p>
      </section>

      {availability?.lastReportId && (
        <div className="mt-4">
          <Suspense fallback={<div className="skeleton h-32" />}>
            <Confirmation
              reportId={availability.lastReportId}
              status={availability.status}
              next={`/m/${slug}/${branchSlug}`}
            />
          </Suspense>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={directions}
          target="_blank"
          rel="noopener"
          className="btn-primary justify-center py-3.5"
        >
          <Icon name="nav" className="size-4" />
          Cómo llegar
        </a>
        <Link href={`/reportar?med=${slug}&sucursal=${branchSlug}`} className="btn-ghost py-3.5">
          <Icon name="plus" className="size-4" />
          Reportar
        </Link>
      </div>

      <dl className="mt-6 divide-y divide-line rounded-2xl bg-surface px-4 text-sm shadow-soft">
        {branch.hours && (
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-muted">Horario</dt>
            <dd className="text-right font-semibold">{branch.hours}</dd>
          </div>
        )}
        {branch.phone && (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Teléfono</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-semibold select-all">{branch.phone}</span>
              <CopyButton text={branch.phone} label="Copiar teléfono" />
            </dd>
          </div>
        )}
        {!branch.verified && (
          <div className="flex items-center gap-2 py-3.5 text-xs text-muted">
            <Icon name="alert" className="size-4 shrink-0 text-warn" />
            Sucursal de ejemplo: los datos todavía no están verificados.
          </div>
        )}
      </dl>

      <h2 className="mt-10 font-display text-2xl font-extrabold tracking-tight">
        Historial de reportes
      </h2>
      {reports.length ? (
        <ol className="relative mt-4 ml-2 flex flex-col gap-5 border-l-2 border-line">
          {reports.map((r) => {
            const rs = statusMeta(r.status);
            return (
              <li key={r.id} className="relative pl-5">
                <span
                  className={`absolute top-1.5 -left-[7px] size-3 rounded-full ring-4 ring-bg ${rs.dot}`}
                />
                <div className="text-sm">
                  <b>{r.who}</b> · <span className={`font-semibold ${rs.text}`}>{rs.label}</span>
                  {r.priceCents != null && isAvailable(r.status) && (
                    <>
                      {" "}
                      · <span className="font-mono">{money(r.priceCents)}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted">{timeAgo(r.createdAt, now)}</div>
                {(r.agreed.length > 0 || r.disagreed.length > 0) && (
                  <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
                    {r.agreed.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="check" className="size-3.5 text-ok" />
                        Lo confirmó {r.agreed.join(", ")}
                      </span>
                    )}
                    {r.disagreed.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="x" className="size-3.5 text-bad" />
                        No coincidió {r.disagreed.join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">Sé la primera persona en reportar esta sucursal.</p>
      )}
      <div className="mt-6 flex gap-3">
        {cursor && (
          <Link href={`/m/${slug}/${branchSlug}`} className="btn-ghost py-2.5">
            Más recientes
          </Link>
        )}
        {nextCursor && (
          <Link href={`/m/${slug}/${branchSlug}?cursor=${nextCursor}`} className="btn-ghost py-2.5">
            Ver reportes anteriores
          </Link>
        )}
      </div>
    </article>
  );
}

/** Botones para confirmar el reporte vigente. Lee la sesión: va dentro de un <Suspense>. */
async function Confirmation({
  reportId,
  status,
  next,
}: {
  reportId: string;
  status: Status;
  next: string;
}) {
  const user = await currentUser();
  if (!user) {
    return (
      <Link
        href={`/entrar?next=${encodeURIComponent(next)}`}
        className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 text-sm shadow-soft transition hover:shadow-lift"
      >
        <span>
          <b>¿Pasaste por aquí hace poco?</b>
          <span className="block text-xs text-muted">Entra para confirmar lo que viste.</span>
        </span>
        <Icon name="arrow" className="size-4 shrink-0" />
      </Link>
    );
  }
  const vote = await getMyVote(user.id, reportId);
  if (vote.own) {
    return (
      <p className="rounded-2xl bg-surface p-4 text-sm text-muted shadow-soft">
        Este es tu reporte. Cuando otra persona lo confirme, sube la cuenta de confirmaciones.
      </p>
    );
  }
  return <ConfirmBox reportId={reportId} status={status} myVote={vote.agrees} />;
}

function BranchSkeleton() {
  return (
    <div aria-busy="true">
      <div className="skeleton h-5 w-40" />
      <div className="mt-4 flex gap-4">
        <div className="skeleton size-16" />
        <div className="flex-1">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-2 h-9 w-56" />
        </div>
      </div>
      <div className="skeleton mt-6 h-36 rounded-[1.6rem]" />
      <div className="skeleton mt-4 h-12 rounded-full" />
      <div className="skeleton mt-6 h-32" />
    </div>
  );
}
