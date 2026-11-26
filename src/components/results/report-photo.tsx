"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { photoSrcSet, photoUrl } from "@/lib/photos";

export type PhotoRef = { base: string; prefix: string; width: number; height: number };

/** Miniatura de la foto de un reporte; al tocarla se abre grande. AVIF con WebP de respaldo. */
export function ReportPhoto({ photo, alt }: { photo: PhotoRef; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="mt-2 block overflow-hidden rounded-xl shadow-soft transition hover:shadow-lift"
        aria-label={`Ver foto: ${alt}`}
      >
        <Picture photo={photo} alt={alt} sizes="96px" className="size-24 object-cover" lazy />
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92dvh] max-w-[min(92vw,56rem)] overflow-hidden rounded-[1.6rem] bg-surface p-0 shadow-lift backdrop:bg-ink/60 backdrop:backdrop-blur-sm"
      >
        <Picture
          photo={photo}
          alt={alt}
          sizes="(min-width: 900px) 56rem, 92vw"
          className="max-h-[85dvh] w-auto object-contain"
        />
        <form method="dialog" className="absolute top-3 right-3">
          <button
            className="grid size-10 place-items-center rounded-full bg-surface/90 shadow-soft"
            aria-label="Cerrar"
          >
            <Icon name="x" className="size-5" />
          </button>
        </form>
      </dialog>
    </>
  );
}

function Picture({
  photo,
  alt,
  sizes,
  className,
  lazy,
}: {
  photo: PhotoRef;
  alt: string;
  sizes: string;
  className: string;
  lazy?: boolean;
}) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={photoSrcSet(photo.base, photo.prefix, "avif")}
        sizes={sizes}
      />
      <img
        src={photoUrl(photo.base, photo.prefix, 800, "webp")}
        srcSet={photoSrcSet(photo.base, photo.prefix, "webp")}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={alt}
        loading={lazy ? "lazy" : undefined}
        decoding="async"
        className={className}
      />
    </picture>
  );
}
