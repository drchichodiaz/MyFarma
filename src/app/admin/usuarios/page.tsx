import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { timeAgo } from "@/lib/format";
import { listUsers, requireAdmin } from "@/server/services/admin";
import { requestTime } from "@/server/time";
import { setUserBlockedAction } from "../actions";
import { NoAdmin } from "../no-admin";

export const metadata: Metadata = { title: "Usuarios" };

export default function AdminUsersPage({ searchParams }: PageProps<"/admin/usuarios">) {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-[2rem]" />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({
  searchParams,
}: {
  searchParams: PageProps<"/admin/usuarios">["searchParams"];
}) {
  const [admin, sp] = await Promise.all([requireAdmin(), searchParams]);
  if (!admin) return <NoAdmin />;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const [{ users, nextCursor }, now] = await Promise.all([listUsers(q, cursor), requestTime()]);

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por correo o nombre"
          aria-label="Buscar usuarios"
          className="input py-3"
        />
        <button className="btn-primary shrink-0">Buscar</button>
      </form>

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-soft"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <b>{u.name ?? "Sin nombre"}</b>
                {u.role === "ADMIN" && <span className="pill bg-lime text-limeink">Admin</span>}
                {u.blockedAt && <span className="pill bg-bad/10 text-bad">Bloqueado</span>}
              </div>
              <div className="font-mono text-xs text-muted">{u.email ?? "—"}</div>
              <div className="text-xs text-muted">
                Entró {timeAgo(u.createdAt, now)} · {u.reports} reportes
                {u.hiddenReports > 0 && ` (${u.hiddenReports} ocultos)`} · {u.alerts} alertas
              </div>
            </div>
            {u.id !== admin.id && u.role !== "ADMIN" && (
              <div className="flex flex-wrap gap-2">
                {u.blockedAt ? (
                  <form action={setUserBlockedAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="blocked" value="0" />
                    <button className="btn-ghost py-2 text-xs">
                      <Icon name="check" className="size-3.5" />
                      Desbloquear
                    </button>
                  </form>
                ) : (
                  <>
                    <form action={setUserBlockedAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="blocked" value="1" />
                      <button className="btn-ghost py-2 text-xs">
                        <Icon name="shield" className="size-3.5" />
                        Bloquear
                      </button>
                    </form>
                    <form action={setUserBlockedAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="blocked" value="1" />
                      <input type="hidden" name="hideReports" value="1" />
                      <button className="btn-ghost py-2 text-xs text-bad">
                        <Icon name="x" className="size-3.5" />
                        Bloquear y ocultar sus reportes
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!users.length && (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Nadie coincide con esa búsqueda.
        </p>
      )}
      <div className="flex gap-3">
        {cursor && (
          <Link
            href={`/admin/usuarios${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className="btn-ghost"
          >
            Más recientes
          </Link>
        )}
        {nextCursor && (
          <Link
            href={`/admin/usuarios?${new URLSearchParams({ ...(q && { q }), cursor: nextCursor })}`}
            className="btn-ghost"
          >
            Más antiguos
          </Link>
        )}
      </div>
    </div>
  );
}
