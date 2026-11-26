import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_LOCATION } from "@/lib/geo";
import { TopNav } from "./nav-links";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-lime text-limeink ${className}`}>
      <Icon name="plus" className="size-[55%]" strokeWidth={3} />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface/90 px-3 shadow-soft backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2"
            aria-label="MyFarma, inicio"
          >
            <Logo className="size-9 transition group-hover:-rotate-8" />
            <span className="font-display text-xl font-black tracking-tight">MyFarma</span>
          </Link>
          <span className="hidden h-8 w-px bg-line lg:block" />
          <span className="hidden items-center gap-2 lg:flex">
            <Icon name="pin" className="size-4 text-muted" />
            <span className="leading-tight">
              <span className="block text-[10px] font-semibold text-muted">Tu zona</span>
              <span className="block text-xs font-extrabold">{DEFAULT_LOCATION.label}</span>
            </span>
          </span>
        </div>
        <TopNav />
        <div className="flex items-center gap-2">
          <span className="pill border border-sun/50 bg-sun/20 text-sunink">Datos de ejemplo</span>
          <Link href="/reportar" className="btn-primary hidden py-2.5 lg:inline-flex">
            Reportar
          </Link>
        </div>
      </div>
    </header>
  );
}
