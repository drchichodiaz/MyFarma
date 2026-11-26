import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: { default: "Moderación", template: "%s · Moderación · MyFarma" },
  robots: { index: false, follow: false },
};

/** Panel de moderación (solo ADMIN; cada página lo verifica dentro de su <Suspense>). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-forest text-lime">
            <Icon name="shield" className="size-5" />
          </span>
          <div>
            <div className="eyebrow">Admin</div>
            <h1 className="font-display text-3xl font-black tracking-tight">Moderación</h1>
          </div>
        </div>
        <nav className="flex gap-1 rounded-full bg-surface2 p-1" aria-label="Moderación">
          <Link href="/admin" className="rounded-full px-4 py-2 text-sm font-bold hover:bg-surface">
            Reportes
          </Link>
          <Link
            href="/admin/usuarios"
            className="rounded-full px-4 py-2 text-sm font-bold hover:bg-surface"
          >
            Usuarios
          </Link>
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
