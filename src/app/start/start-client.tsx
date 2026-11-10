"use client";

import { useState } from "react";

type ClaimState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "assigned"; number: string; existing: boolean }
  | { phase: "error"; message: string };

function formatNumber(e164: string) {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `+1 (${match[1]}) ${match[2]}-${match[3]}` : e164;
}

export function ClaimForm() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<ClaimState>({ phase: "idle" });

  async function claim(event: React.FormEvent) {
    event.preventDefault();
    if (state.phase === "submitting") return;
    setState({ phase: "submitting" });
    try {
      const response = await fetch("/api/onboarding/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = (await response.json()) as { assigned_number?: string; existing?: boolean; error?: string };
      if (!response.ok || !data.assigned_number) {
        setState({ phase: "error", message: data.error ?? "Something went wrong. Try again in a moment." });
        return;
      }
      setState({ phase: "assigned", number: data.assigned_number, existing: Boolean(data.existing) });
    } catch {
      setState({ phase: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  if (state.phase === "assigned") {
    return <AssignedNumber number={state.number} existing={state.existing} />;
  }

  return (
    <form onSubmit={claim}>
      <label htmlFor="phone" className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#898879]">
        Your phone number
      </label>
      <input
        id="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
          if (state.phase === "error") setState({ phase: "idle" });
        }}
        placeholder="+1 (555) 010-0000"
        className="mt-3 w-full border-b border-[#d8d2c4] bg-transparent pb-3 text-[clamp(1.3rem,3vw,1.7rem)] tracking-[-.02em] text-[#292a24] outline-none transition placeholder:text-[#c6c2b4] focus:border-[#292a24]"
      />
      {state.phase === "error" && (
        <p role="alert" className="mt-3 text-[11px] leading-[1.7] text-[#b3573a]">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={state.phase === "submitting"}
        className="mt-7 flex w-full items-center justify-center rounded-full bg-[#292a24] px-6 py-4 text-[12px] font-semibold text-[#fffdf7] transition hover:-translate-y-0.5 hover:bg-[#1d1e19] disabled:translate-y-0 disabled:opacity-60"
      >
        {state.phase === "submitting" ? "Reserving your number…" : "Get Your Pogo Number"}
      </button>
      <p className="mt-6 text-[11px] leading-[1.8] text-[#9a988c]">
        We reserve a dedicated Pogo number for your phone. Nothing is sent to you — you send the first message, which is what activates your private Pogo.
      </p>
    </form>
  );
}

function AssignedNumber({ number, existing }: { number: string; existing: boolean }) {
  const [copied, setCopied] = useState(false);
  const display = formatNumber(number);
  return (
    <div aria-live="polite">
      <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#737b59]">
        {existing ? "Your Pogo number" : "Reserved for you"}
      </p>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(number);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            // Clipboard unavailable; the number is visible to copy by hand.
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
      <a
        href={`sms:${number}`}
        className="mt-7 flex w-full items-center justify-center rounded-full bg-[#d97850] px-6 py-4 text-[12px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#c96a43]"
      >
        Open Messages &amp; Say Hi
      </a>
      <p className="mt-6 text-[11px] leading-[1.8] text-[#9a988c]">
        Text this number from your phone — your first message is what switches Pogo on. It only ever answers you, and it never texts first.
      </p>
    </div>
  );
}
