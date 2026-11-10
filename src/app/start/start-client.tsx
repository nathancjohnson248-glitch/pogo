"use client";

import { useState } from "react";

export function CopyNumber({ display, e164 }: { display: string; e164: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(e164);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard unavailable; the number is still visible to copy by hand.
        }
      }}
      className="group mt-2 flex w-full items-baseline justify-between gap-3 border-b border-[#e4ded2] pb-4 text-left transition hover:border-[#c9c2b1]"
      aria-label={`Copy ${display} to clipboard`}
    >
      <span className="display text-[clamp(1.5rem,3.4vw,2.1rem)] tracking-[-.03em]">{display}</span>
      <span className={`text-[10px] font-semibold uppercase tracking-[.16em] transition ${copied ? "text-[#737b59]" : "text-[#b4b1a2] group-hover:text-[#898879]"}`}>
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

export function TextPogoButton({ e164 }: { e164: string }) {
  return (
    <a
      href={`sms:${e164}`}
      className="mt-7 flex w-full items-center justify-center rounded-full bg-[#292a24] px-6 py-4 text-[12px] font-semibold text-[#fffdf7] transition hover:-translate-y-0.5 hover:bg-[#1d1e19]"
    >
      Open Messages &amp; Say Hi
    </a>
  );
}
