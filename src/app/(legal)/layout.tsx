export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#292a24]">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 md:px-12 lg:px-16">
        <a href="/" className="flex items-center gap-2.5">
          <img src="/pogo-mascot.svg" alt="pogo" className="h-10 w-10 rounded-xl" />
          <span className="text-[21px] font-semibold tracking-[-.07em]">Pogo</span>
        </a>
        <a href="/" className="text-[12px] text-[#747469] hover:text-[#292a24]">← Back</a>
      </nav>
      <article className="mx-auto max-w-[720px] px-6 pb-28 pt-10 md:pt-16 [&_h1]:display [&_h2]:mt-12 [&_h2]:text-[15px] [&_h2]:font-semibold [&_p]:mt-4 [&_p]:text-[13px] [&_p]:leading-[1.9] [&_p]:text-[#67685d] [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:text-[13px] [&_li]:leading-[1.8] [&_li]:text-[#67685d]">
        {children}
      </article>
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
