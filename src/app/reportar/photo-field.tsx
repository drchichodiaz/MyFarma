"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { prepareImage } from "@/lib/client-image";
import { requestPhotoUpload } from "./actions";

/** Error con un mensaje listo para mostrar. */
class PhotoError extends Error {}

type State =
  | { kind: "empty" }
  | { kind: "working"; step: string; preview: string }
  | { kind: "ready"; key: string; preview: string; name: string }
  | { kind: "error"; message: string };

/**
 * Paso "Foto": prepara la imagen en el navegador y la sube directo a R2 con una URL firmada.
 * El formulario solo manda la clave (photoKey); el worker la procesa después.
 */
export function PhotoField({
  step,
  onBusyChange,
}: {
  step: number;
  onBusyChange: (busy: boolean) => void;
}) {
  const [state, setState] = useState<State>({ kind: "empty" });
  const input = useRef<HTMLInputElement>(null);
  const preview = state.kind === "working" || state.kind === "ready" ? state.preview : null;

  useEffect(() => onBusyChange(state.kind === "working"), [state.kind, onBusyChange]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ kind: "error", message: "Elige una imagen (foto del anaquel o del recibo)." });
      return;
    }
    const local = URL.createObjectURL(file);
    try {
      setState({ kind: "working", step: "Preparando foto…", preview: local });
      const { blob, type } = await prepareImage(file);
      setState({ kind: "working", step: "Subiendo foto…", preview: local });
      const ticket = await requestPhotoUpload({ type, size: blob.size });
      if (!ticket.ok) throw new PhotoError(ticket.error);
      const res = await fetch(ticket.url, {
        method: "PUT",
        body: blob,
        headers: { "content-type": type },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        throw new PhotoError("No se pudo subir la foto. Revisa tu conexión e intenta otra vez.");
      }
      setState({ kind: "ready", key: ticket.key, preview: local, name: file.name });
    } catch (error) {
      URL.revokeObjectURL(local);
      setState({
        kind: "error",
        message:
          error instanceof PhotoError
            ? error.message
            : "No pudimos leer o subir esa foto. Prueba con otra.",
      });
    }
  }

  function clear() {
    setState({ kind: "empty" });
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="flabel">
        <span className="stepn">{step}</span>Foto del anaquel o del recibo{" "}
        <span className="font-medium text-muted">(opcional)</span>
      </div>
      <input type="hidden" name="photoKey" value={state.kind === "ready" ? state.key : ""} />
      <div className="mt-2 flex items-center gap-4 rounded-2xl border-2 border-dashed border-tblue bg-tblue/15 p-4 transition has-[label:hover]:bg-tblue/30">
        <label htmlFor="photo" className="flex min-w-0 flex-1 cursor-pointer items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-tblue text-tileink">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:)
              <img src={preview} alt="Foto elegida" className="size-full object-cover" />
            ) : (
              <Icon name="camera" />
            )}
          </span>
          <span className="min-w-0" aria-live="polite">
            <span className="block truncate text-sm font-bold">
              {state.kind === "empty" && "Agregar foto"}
              {state.kind === "working" && state.step}
              {state.kind === "ready" && "Foto lista"}
              {state.kind === "error" && "Prueba con otra foto"}
            </span>
            <span
              className={`block text-xs ${state.kind === "error" ? "font-semibold text-bad" : "text-muted"}`}
            >
              {state.kind === "error"
                ? state.message
                : "Ayuda a que otros confíen en tu reporte. Tapa tus datos personales."}
            </span>
          </span>
        </label>
        {(state.kind === "ready" || state.kind === "error") && (
          <button
            type="button"
            onClick={clear}
            aria-label="Quitar foto"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-muted shadow-soft hover:text-ink"
          >
            <Icon name="x" className="size-4" />
          </button>
        )}
      </div>
      <input
        ref={input}
        id="photo"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
