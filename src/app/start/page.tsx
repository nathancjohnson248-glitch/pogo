import type { Metadata } from "next";
import { ClaimForm } from "./start-client";

export const metadata: Metadata = {
  title: "Meet Pogo",
  description: "Get your own Pogo number and start the conversation. No app, no dashboard — just iMessage."
};

export default function Start() {
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#292a24]">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 md:px-12 lg:px-16">
        <a href="/" className="flex items-center gap-2.5">
          <img src="/pogo-mascot.svg" alt="pogo" className="h-10 w-10 rounded-xl" />
          <span className="text-[21px] font-semibold tracking-[-.07em]">Pogo</span>
        </a>
        <a href="/" className="text-[12px] text-[#747469] hover:text-[#292a24]">← Back</a>
      </nav>

      <section className="mx-auto grid max-w-[1100px] gap-16 px-6 pb-28 pt-14 md:px-12 md:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
        <div>
          <p className="mb-6 text-[10px] font-semibold uppercase tracking-[.22em] text-[#898879]">Private Beta</p>
          <h1 className="display max-w-[560px] text-[clamp(3rem,6vw,5.4rem)] leading-[.94]">
            There's no app.<br />
            <span className="italic text-[#737b59]">Just a number.</span>
          </h1>
          <p className="mt-8 max-w-[440px] text-[15px] leading-[1.85] text-[#77776d]">
            Pogo lives in iMessage. Send the first message and the conversation is yours — your context, your history, kept separate from everyone else's.
          </p>

          <div className="mt-12 border-t border-[#ded8cc]">
            {[
              ["01", "Enter your number", "We reserve a dedicated Pogo number just for your phone."],
              ["02", "Send the first text", "Your first message activates your private Pogo. It never texts first."],
              ["03", "Keep the thread going", "Come back anytime. It picks up exactly where you left off."]
            ].map(([n, title, desc]) => (
              <div key={n} className="grid grid-cols-[48px_1fr] gap-4 border-b border-[#ded8cc] py-6">
                <span className="display text-[20px] text-[#b4b1a2]">{n}</span>
                <div>
                  <p className="text-[14px] font-semibold">{title}</p>
                  <p className="mt-1 text-[12px] leading-[1.7] text-[#8b897e]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:sticky lg:top-16">
          <div className="rounded-[2rem] border border-[#e4ded2] bg-[#fffdf8] p-8 shadow-[0_24px_80px_rgba(53,46,33,.08)] md:p-10">
            <img src="/pogo-mascot.svg" alt="" className="mb-8 h-14 w-14 rounded-2xl" />
            <ClaimForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e2ddd2] px-6 py-8 md:px-12 lg:px-16">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 text-[10px] text-[#8d8b7d] md:flex-row">
          <a href="/" className="flex items-center gap-2 text-[13px] font-semibold text-[#34352e]">
            <img src="/pogo-mascot.svg" alt="" className="h-7 w-7 rounded-lg" /> pogo
          </a>
          <div className="flex gap-5"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        </div>
      </footer>
    </main>
  );
}
