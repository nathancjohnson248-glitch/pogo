export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f4ec] px-6 text-center text-[#292a24]">
      <div>
        <img src="/pogo-mascot.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl" />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[.22em] text-[#898879]">404</p>
        <h1 className="display mt-3 text-5xl leading-[1] md:text-6xl">
          This thread doesn&apos;t exist<span className="italic text-[#737b59]"> — yet.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[360px] text-[13px] leading-[1.8] text-[#77776d]">
          The page you&apos;re looking for isn&apos;t here. The conversation, though, is always open.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <a href="/" className="rounded-full bg-[#292a24] px-6 py-3.5 text-[11px] font-semibold text-[#fffdf7] transition hover:-translate-y-0.5">Back Home</a>
          <a href="/start" className="px-2 py-3 text-[12px] text-[#747469] hover:text-[#292a24]">Meet Pogo</a>
        </div>
      </div>
    </main>
  );
}
