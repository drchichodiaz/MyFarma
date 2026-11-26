"use client";

import { useState } from "react";
import { Icon } from "./icon";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => {})
      }
      className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface2 hover:text-ink"
    >
      <Icon name={copied ? "check" : "phone"} className={`size-4 ${copied ? "text-ok" : ""}`} />
    </button>
  );
}
