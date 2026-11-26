"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { submitConfirmation, type ConfirmState } from "@/app/reportar/actions";
import { Icon } from "@/components/ui/icon";
import type { Status } from "@/lib/status";

/**
 * "Sí había / No había" sobre el reporte vigente. El voto se marca al instante
 * (useOptimistic) y la ficha se actualiza cuando el servidor recalcula el estado.
 */
export function ConfirmBox({
  reportId,
  status,
  myVote,
}: {
  reportId: string;
  status: Status;
  myVote: boolean | null;
}) {
  const [state, action] = useActionState<ConfirmState, FormData>(submitConfirmation, {});
  const [vote, setVote] = useOptimistic(myVote);
  const [pending, start] = useTransition();

  // Sobre un "No hay", estar de acuerdo es "Tampoco había".
  const options =
    status === "OUT"
      ? [
          { agrees: true, label: "Tampoco había", icon: "x" as const },
          { agrees: false, label: "Sí había", icon: "check" as const },
        ]
      : [
          { agrees: true, label: "Sí había", icon: "check" as const },
          { agrees: false, label: "Ya no había", icon: "x" as const },
        ];

  const send = (agrees: boolean) => {
    const fd = new FormData();
    fd.set("reportId", reportId);
    fd.set("agrees", agrees ? "1" : "0");
    start(async () => {
      setVote(agrees);
      await action(fd);
    });
  };

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft">
      <div className="text-sm font-extrabold">¿Pasaste por aquí hace poco?</div>
      <p className="text-xs text-muted">Confirma lo que viste. Ayuda a que el dato siga fresco.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = vote === o.agrees;
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => send(o.agrees)}
              disabled={pending}
              aria-pressed={on}
              className={`btn-ghost py-3 disabled:opacity-70 ${on ? "border-brand bg-brand text-brandink hover:bg-brand" : ""}`}
            >
              <Icon name={o.icon} className="size-4" />
              {o.label}
            </button>
          );
        })}
      </div>
      {state.error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-bad">
          <Icon name="alert" className="size-3.5 shrink-0" />
          {state.error}
        </p>
      )}
      {state.done && !pending && !state.error && (
        <p className="mt-2 text-xs font-semibold text-ok">Gracias, tu confirmación ya cuenta.</p>
      )}
    </div>
  );
}
