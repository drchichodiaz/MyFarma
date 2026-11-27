import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LocationChip, LocationChipStatic } from "./location-chip";
import { TopNav } from "./nav-links";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

/** Marca: pin de ubicación con cápsula. Original y variantes en `brand/`. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`grid place-items-center ${className}`}>
      <Image
        src="/brand/logo.png"
        alt=""
        width={160}
        height={160}
        sizes="80px"
        className="size-full"
      />
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
          <div className="hidden lg:block">
            <Suspense
              fallback={
                <span className="flex items-center gap-2 px-2 py-1.5">
                  <LocationChipStatic />
                </span>
              }
            >
              <LocationChip />
            </Suspense>
          </div>
        </div>
        <TopNav />
        <div className="flex items-center gap-2">
          <span className="pill hidden border border-sun/50 bg-sun/20 text-sunink sm:inline-flex">
            Beta
          </span>
          <Link href="/reportar" className="btn-primary hidden py-2.5 lg:inline-flex">
            Reportar
          </Link>
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
