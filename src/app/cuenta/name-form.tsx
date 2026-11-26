"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { publicName } from "@/lib/people";
import { updateName, type NameState } from "./actions";

export function NameForm({ name }: { name: string | null }) {
  const [state, action, pending] = useActionState<NameState, FormData>(updateName, {});
  const [value, setValue] = useState(name ?? "");
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <label htmlFor="name" className="text-sm font-extrabold">
        Tu nombre
      </label>
      <div className="flex gap-2">
        <input
          id="name"
          name="name"
          autoComplete="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nombre y apellido"
          aria-invalid={state.error ? true : undefined}
          className="input"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary shrink-0 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {state.error ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-bad">
          <Icon name="alert" className="size-4 shrink-0" />
          {state.error}
        </p>
      ) : (
        <p className="text-xs text-muted">
          En público se verá como <b className="text-ink">{publicName(value)}</b>
          {state.saved && <span className="font-semibold text-ok"> · Guardado</span>}
        </p>
      )}
    </form>
  );
}
