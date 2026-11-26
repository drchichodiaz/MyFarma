"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/icon";
import { signInWithEmail, type EmailState } from "./actions";

export function EmailForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(signInWithEmail, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-sm font-extrabold">
        Con tu correo
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        placeholder="nombre@gmail.com"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "email-error" : "email-hint"}
        className="input"
      />
      {state.error ? (
        <p id="email-error" className="flex items-start gap-1.5 text-sm font-semibold text-bad">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : (
        <p id="email-hint" className="text-xs text-muted">
          Te mandamos un enlace para entrar. Sin contraseñas.
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-ghost py-3.5 disabled:opacity-60">
        <Icon name="mail" className="size-4" />
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </button>
    </form>
  );
}
