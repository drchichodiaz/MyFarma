import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { getCallOptions, getCallSheet, requireAdmin } from "@/server/services/admin";
import { requestTime } from "@/server/time";
import { NoAdmin } from "../no-admin";
import { CallSheetForm } from "./call-sheet-form";

export const metadata: Metadata = { title: "Carga rápida" };

export default function CallSheetPage({ searchParams }: PageProps<"/admin/carga">) {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-[2rem]" />}>
      <CallSheet searchParams={searchParams} />
    </Suspense>
  );
}

async function CallSheet({
  searchParams,
}: {
  searchParams: PageProps<"/admin/carga">["searchParams"];
}) {
  const [admin, sp] = await Promise.all([requireAdmin(), searchParams]);
  if (!admin) return <NoAdmin />;

  const { medications, chains } = await getCallOptions();
  const medId = Number(sp.med) || 0;
  const chainId = Number(sp.cadena) || 0;
  const med = medications.find((m) => m.id === medId);
  const chain = chains.find((c) => c.id === chainId);
  const [rows, now] =
    med && chain ? await Promise.all([getCallSheet(chain.id, med.id), requestTime()]) : [[], 0];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[2rem] bg-surface p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Carga rápida</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Lo que averiguas llamando a una cadena, de una vez. Los reportes salen en público como
          «MyFarma (llamada)», no con tu nombre, y los «Hay» disparan las alertas de quien esté
          cerca.
        </p>

        <form method="get" className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Medicamento
            <select name="med" defaultValue={med?.id ?? ""} required className="input py-3 text-sm">
              <option value="" disabled>
                Elige…
              </option>
              {medications.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.activeIngredient} {m.strength} · {m.form}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Cadena
            <select
              name="cadena"
              defaultValue={chain?.id ?? ""}
              required
              className="input py-3 text-sm"
            >
              <option value="" disabled>
                Elige…
              </option>
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.branches})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-primary justify-center">
            <Icon name="phone" className="size-4" />
            Ver sucursales
          </button>
        </form>
      </div>

      {med && chain ? (
        <CallSheetForm
          key={`${med.id}-${chain.id}`}
          medicationId={med.id}
          medLabel={`${med.activeIngredient} ${med.strength}`}
          chainName={chain.name}
          now={now}
          rows={rows.map((r) => ({
            ...r,
            confirmedAt: r.confirmedAt ? new Date(r.confirmedAt).getTime() : null,
          }))}
        />
      ) : (
        <p className="rounded-2xl bg-surface2 p-5 text-sm font-semibold text-muted">
          Elige el medicamento y la cadena que llamaste para ver sus sucursales.
        </p>
      )}
    </div>
  );
}
