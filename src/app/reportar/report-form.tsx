"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChainBadge } from "@/components/med/chain-badge";
import { Icon } from "@/components/ui/icon";
import { money } from "@/lib/format";
import { parsePrice } from "@/lib/price";
import { STATUS, type Status } from "@/lib/status";
import { submitReport, type ReportState } from "./actions";
import { PhotoField } from "./photo-field";

type Med = { id: number; slug: string; activeIngredient: string; strength: string; form: string };
type Branch = { id: number; slug: string; name: string; chainName: string; chainColor: string };

const OPTIONS: Status[] = ["AVAILABLE", "LOW", "OUT"];

export function ReportForm({
  medications,
  branches,
  defaultMedId,
  defaultBranchId,
  who,
  photos,
}: {
  medications: Med[];
  branches: Branch[];
  defaultMedId?: number;
  defaultBranchId?: number;
  who: string;
  /** Si R2 está configurado, aparece el paso de foto. */
  photos: boolean;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, {
    status: "idle",
  });
  const [medId, setMedId] = useState(defaultMedId ?? medications[0]?.id);
  const [branchId, setBranchId] = useState<number | undefined>(defaultBranchId);
  const [status, setStatus] = useState<Status>("AVAILABLE");
  const [price, setPrice] = useState("");
  // Al pulsar "Hacer otro reporte" se descarta el éxito de ese reporte y vuelve el formulario.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const med = medications.find((m) => m.id === medId);
  const branch = branches.find((b) => b.id === branchId);
  const cents = status === "OUT" ? null : parsePrice(price);
  const error = state.status === "error" ? state : null;

  const preview = (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
      <div className="rounded-[2rem] bg-lime p-4 text-limeink sm:p-5">
        <div className="mb-3 flex items-center justify-between px-1 text-xs font-extrabold tracking-[.14em] uppercase">
          <span>Así se verá tu reporte</span>
          <span className="pulse relative size-2 rounded-full bg-limeink text-limeink" />
        </div>
        <div className="rounded-[1.4rem] bg-surface p-3 text-ink shadow-lift sm:p-4">
          <div className="flex items-start gap-3">
            {branch ? (
              <ChainBadge name={branch.chainName} color={branch.chainColor} />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-line text-muted">
                <Icon name="pin" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-muted">
                    {branch?.chainName ?? "Farmacia"}
                  </div>
                  <div className="truncate font-display text-xl leading-tight font-extrabold">
                    {branch?.name ?? "Elige la sucursal"}
                  </div>
                </div>
                <span className={`pill shrink-0 ${STATUS[status].pill}`}>
                  <Icon name={STATUS[status].icon} className="size-3.5" />
                  {STATUS[status].label}
                </span>
              </div>
              <div className="mt-1 text-xs font-medium text-muted">
                {med ? `${med.activeIngredient} ${med.strength} · ${med.form}` : ""}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3 py-2.5 text-xs text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="pulse relative size-2 rounded-full bg-ok text-ok" />
              Justo ahora · por {who}
            </span>
            <span className="font-mono text-base font-semibold text-ink">
              {cents != null && !Number.isNaN(cents) ? money(cents) : "—"}
            </span>
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[2rem] bg-tteal p-6 text-sm text-tileink">
        <span className="tile-ic absolute -right-4 -bottom-5 opacity-80" aria-hidden="true">
          <Icon name="shield" className="size-28" />
        </span>
        <div className="relative font-display text-2xl leading-tight font-extrabold">
          Reportes que ayudan
        </div>
        <ul className="relative mt-3 flex max-w-[22rem] flex-col gap-2.5 font-medium">
          {[
            "Reporta solo lo que viste hoy, con la concentración exacta.",
            "Si quedaban pocas cajas, márcalo. Ayuda a decidir si vale la pena ir ya.",
            "No escribas datos de tu receta ni de tu cédula.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-tileink text-tteal">
                <Icon name="check" className="size-3" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );

  if (state.status === "ok" && state.reportId !== dismissed && med && branch) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
        <div className="rise rounded-[2rem] bg-surface p-5 shadow-soft sm:p-8">
          <Success
            med={med}
            branch={branch}
            onAgain={() => {
              setDismissed(state.reportId);
              setPrice("");
            }}
          />
        </div>
        {preview}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
      <form
        action={action}
        className="rise flex flex-col gap-7 rounded-[2rem] bg-surface p-5 shadow-soft sm:p-8"
        style={{ "--d": 1 } as React.CSSProperties}
        noValidate
      >
        <div>
          <label htmlFor="medicationId" className="flabel">
            <span className="stepn">1</span>Medicamento
          </label>
          <Select
            id="medicationId"
            value={medId ?? ""}
            onChange={(v) => setMedId(Number(v))}
            invalid={error?.field === "medication"}
          >
            {medications.map((m) => (
              <option key={m.id} value={m.id}>
                {m.activeIngredient} {m.strength} · {m.form}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="branchId" className="flabel">
            <span className="stepn">2</span>Farmacia y sucursal
          </label>
          <Select
            id="branchId"
            value={branchId ?? ""}
            onChange={(v) => setBranchId(v ? Number(v) : undefined)}
            invalid={error?.field === "branch"}
            describedBy={error?.field === "branch" ? "form-error" : undefined}
          >
            <option value="">Elige la sucursal donde estuviste</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.chainName} · {b.name}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="flabel">
            <span className="stepn">3</span>¿Qué encontraste?
          </legend>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {OPTIONS.map((k) => (
              <label key={k} className="cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={k}
                  checked={status === k}
                  onChange={() => setStatus(k)}
                  className="peer sr-only"
                />
                <span
                  className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-line bg-surface px-2 py-5 text-center text-sm font-extrabold text-ink transition duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-brand hover:border-ink/30 ${STATUS[k].opt}`}
                >
                  <span
                    className={`opt-ic grid size-12 place-items-center rounded-full transition ${STATUS[k].tint}`}
                  >
                    <Icon name={STATUS[k].icon} className="size-6" />
                  </span>
                  {STATUS[k].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {status !== "OUT" && (
          <div>
            <label htmlFor="price" className="flabel">
              <span className="stepn">4</span>Precio{" "}
              <span className="font-medium text-muted">(opcional)</span>
            </label>
            <div className="input mt-2 flex items-center gap-2">
              <span className="font-mono font-semibold text-muted">B/.</span>
              <input
                id="price"
                name="price"
                inputMode="decimal"
                autoComplete="off"
                placeholder="15.20"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={error?.field === "price" ? true : undefined}
                className="min-w-0 flex-1 bg-transparent font-mono outline-none placeholder:text-muted/60"
              />
            </div>
          </div>
        )}

        {photos && (
          <PhotoField
            key={dismissed ?? "first"}
            step={status === "OUT" ? 4 : 5}
            onBusyChange={setUploading}
          />
        )}

        {error && (
          <p
            id="form-error"
            role="alert"
            className="flex items-start gap-2 rounded-2xl bg-bad/10 p-3 text-sm font-semibold text-bad"
          >
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            {error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || uploading}
          className="btn-primary justify-center py-4 text-base disabled:opacity-60"
        >
          <Icon name="check" className="size-5" />
          {pending ? "Publicando…" : uploading ? "Esperando la foto…" : "Publicar reporte"}
        </button>
      </form>
      {preview}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  children,
}: {
  id: string;
  value: string | number;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-2">
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`input appearance-none pr-10 ${invalid ? "border-bad/60" : ""}`}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted">
        <Icon name="chev" className="size-4" />
      </span>
    </div>
  );
}

const CONFETTI = ["bg-sun", "bg-tteal", "bg-tsalmon", "bg-lime", "bg-tpink", "bg-tblue"];

function Success({ med, branch, onAgain }: { med: Med; branch: Branch; onAgain: () => void }) {
  return (
    <div className="flex flex-col items-center py-8 text-center" role="status">
      <div className="relative size-24">
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const d = 62 + (i % 3) * 18;
          return (
            <span
              key={i}
              className={`burst ${CONFETTI[i % CONFETTI.length]}`}
              style={
                {
                  width: i % 2 ? 8 : 12,
                  height: i % 2 ? 8 : 6,
                  "--tx": `${Math.round(Math.cos(a) * d)}px`,
                  "--ty": `${Math.round(Math.sin(a) * d)}px`,
                  "--r": `${i * 47}deg`,
                } as React.CSSProperties
              }
            />
          );
        })}
        <div className="pop grid size-24 place-items-center rounded-full bg-lime text-limeink shadow-lift">
          <svg
            viewBox="0 0 24 24"
            className="size-11"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path className="draw" d="M20 6 9 17l-5-5" />
          </svg>
        </div>
      </div>
      <h2 className="mt-7 font-display text-5xl font-black tracking-[-0.04em]">¡Gracias!</h2>
      <p className="mt-1 font-display text-xl font-extrabold">Reporte publicado</p>
      <p className="mt-2 max-w-sm text-muted">
        Ya se ve en {branch.chainName} {branch.name}. Le ahorraste el recorrido al siguiente
        paciente que busque {med.activeIngredient.toLowerCase()} {med.strength}.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href={`/m/${med.slug}/${branch.slug}`} className="btn-primary">
          Ver {med.activeIngredient.toLowerCase()} {med.strength}
        </Link>
        <button type="button" onClick={onAgain} className="btn-ghost">
          Hacer otro reporte
        </button>
      </div>
    </div>
  );
}
