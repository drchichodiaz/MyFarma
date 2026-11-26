import type { IconName } from "@/components/ui/icon";

export type Status = "AVAILABLE" | "LOW" | "OUT";

type Meta = {
  label: string;
  pill: string;
  dot: string;
  text: string;
  panel: string;
  icon: IconName;
  hint: string;
  /** Opción elegida en el formulario de reporte (radio con clase `peer`). */
  opt: string;
  /** Círculo del ícono de la opción sin elegir. */
  tint: string;
};

/** Apariencia de cada estado. Las clases van completas para que Tailwind las detecte. */
export const STATUS: Record<Status | "NONE", Meta> = {
  AVAILABLE: {
    label: "Hay",
    pill: "bg-ok/15 text-ok",
    dot: "bg-ok",
    text: "text-ok",
    panel: "bg-ok/10",
    icon: "check",
    hint: "Disponible para retirar",
    opt: "peer-checked:border-ok peer-checked:bg-ok peer-checked:text-onstat peer-checked:shadow-lift peer-checked:-translate-y-1",
    tint: "bg-ok/15 text-ok",
  },
  LOW: {
    label: "Quedan pocas",
    pill: "bg-warn/15 text-warn",
    dot: "bg-warn",
    text: "text-warn",
    panel: "bg-warn/10",
    icon: "alert",
    hint: "Ve pronto, quedan pocas",
    opt: "peer-checked:border-warn peer-checked:bg-warn peer-checked:text-onstat peer-checked:shadow-lift peer-checked:-translate-y-1",
    tint: "bg-warn/15 text-warn",
  },
  OUT: {
    label: "No hay",
    pill: "bg-bad/15 text-bad",
    dot: "bg-bad",
    text: "text-bad",
    panel: "bg-bad/10",
    icon: "x",
    hint: "Prueba otra sucursal",
    opt: "peer-checked:border-bad peer-checked:bg-bad peer-checked:text-onstat peer-checked:shadow-lift peer-checked:-translate-y-1",
    tint: "bg-bad/15 text-bad",
  },
  NONE: {
    label: "Sin reportes",
    pill: "bg-surface2 text-muted",
    dot: "bg-muted/50",
    text: "text-muted",
    panel: "bg-surface2",
    icon: "clock",
    hint: "Si pasas por aquí, repórtalo",
    opt: "",
    tint: "bg-surface2 text-muted",
  },
};

export const statusMeta = (status: Status | null | undefined) => STATUS[status ?? "NONE"];
export const isAvailable = (status: Status | null | undefined) =>
  status === "AVAILABLE" || status === "LOW";

/** Token de color (de la DB) → clase de fondo pastel. */
export const TILE: Record<string, string> = {
  teal: "bg-tteal",
  yellow: "bg-tyellow",
  salmon: "bg-tsalmon",
  pink: "bg-tpink",
  blue: "bg-tblue",
  sun: "bg-sun",
  lime: "bg-lime",
};
export const tile = (color: string | null | undefined) => TILE[color ?? ""] ?? "bg-lime";
