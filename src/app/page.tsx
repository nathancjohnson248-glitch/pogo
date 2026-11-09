"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, Check, ChevronDown, CircleArrowUp, Clock3, Command, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: .7, ease: [0.22, 1, 0.36, 1] } }
};

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`pogo-mark ${small ? "w-8 h-8" : ""}`}><span>p</span></span>;
}

function PhoneDemo() {
  const [sent, setSent] = useState(false);
  return (
    <div className="relative mx-auto w-full max-w-[390px]">
      <div className="absolute -inset-5 rounded-[3rem] bg-[#e8dfd0] blur-2xl opacity-70" />
      <div className="relative rounded-[38px] border-[7px] border-[#292a25] bg-[#fbfaf6] p-3 shadow-[0_30px_90px_rgba(35,35,28,.2)]">
        <div className="mx-auto mb-4 h-5 w-28 rounded-full bg-[#292a25]" />
        <div className="flex items-center justify-between border-b border-black/5 px-2 pb-3">
          <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e9e4d8]"><Mark small /></div><div><p className="text-sm font-semibold">Pogo</p><p className="text-[10px] text-[#88877d]">always in your corner</p></div></div>
          <span className="rounded-full bg-[#edf0e6] px-2.5 py-1 text-[10px] font-medium text-[#66704d]">● online</span>
        </div>
        <div className="flex min-h-[390px] flex-col gap-3 px-2 py-5">
          <p className="self-center rounded-full bg-[#efeee9] px-3 py-1 text-[10px] text-[#929087]">Today 9:41 AM</p>
          <div className="chat-bubble user max-w-[83%] self-end bg-[#dce3ce] px-4 py-3 text-[13px] leading-relaxed">Can you find a good time for lunch with Maya next week and send her a message?</div>
          <div className="chat-bubble max-w-[88%] bg-[#efeee9] px-4 py-3 text-[13px] leading-relaxed">On it. I’ll check your calendar and find a few times that work.</div>
          <div className="ml-1 rounded-2xl border border-[#e5e1d7] bg-white p-3.5">
            <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4e5db] text-[#c86c48]"><Clock3 size={14}/></span><div><p className="text-xs font-semibold">Found 3 good times</p><p className="text-[10px] text-[#929087]">Calendar checked · just now</p></div><Check className="ml-auto text-[#75805c]" size={15}/></div>
            <div className="space-y-1.5 text-[11px] text-[#5c5d53]"><p className="rounded-lg bg-[#f7f5ef] px-2.5 py-2">Tue, Nov 10 · 12:30 PM</p><p className="rounded-lg bg-[#f7f5ef] px-2.5 py-2">Wed, Nov 11 · 1:00 PM</p><p className="rounded-lg bg-[#f7f5ef] px-2.5 py-2">Fri, Nov 13 · 12:00 PM</p></div>
          </div>
          {sent && <div className="chat-bubble max-w-[88%] bg-[#efeee9] px-4 py-3 text-[13px] leading-relaxed"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#75805c]">Done</span>Message sent to Maya with those options. You’re all set.</div>}
          {!sent && <button onClick={() => setSent(true)} className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-[#737b59] py-3 text-xs font-semibold text-white transition hover:bg-[#5f6848]">Approve & send message <ArrowRight size={14}/></button>}
        </div>
        <div className="mx-auto mt-1 h-1 w-24 rounded-full bg-[#292a25]/20" />
      </div>
      <div className="absolute -right-8 top-16 hidden rotate-6 rounded-2xl border border-[#e5dfd2] bg-[#fffdf8] px-4 py-3 shadow-xl md:block"><div className="flex items-center gap-2 text-[11px] font-semibold"><span className="h-2 w-2 rounded-full bg-[#8a966b]"/> actually getting it done</div></div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className="overflow-hidden">
      <nav className="relative z-30 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 md:px-12 lg:px-16">
        <a href="#" className="flex items-center gap-2.5"><Mark/><span className="text-[21px] font-semibold tracking-[-.06em]">pogo</span></a>
        <div className="hidden items-center gap-9 text-[13px] text-[#68695f] md:flex"><a className="transition hover:text-[#24251f]" href="#how">How it works</a><a className="transition hover:text-[#24251f]" href="#capabilities">What it can do</a><a className="transition hover:text-[#24251f]" href="#trust">Your say, always</a></div>
        <div className="hidden items-center gap-5 md:flex"><a href="/login" className="text-[13px] text-[#68695f] hover:text-[#24251f]">Log in</a><a href="/login" className="rounded-full bg-[#24251f] px-5 py-3 text-[12px] font-semibold text-[#fbf8f0] transition hover:-translate-y-0.5 hover:bg-[#45463d]">Meet your Pogo <ArrowRight className="ml-2 inline" size={13}/></a></div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-full border border-black/10 p-2 md:hidden" aria-label="Toggle menu"><ChevronDown size={18}/></button>
        {menuOpen && <div className="absolute left-5 right-5 top-[76px] rounded-2xl border border-black/10 bg-[#fffdf8] p-5 shadow-xl md:hidden"><div className="flex flex-col gap-4 text-sm"><a href="#how" onClick={()=>setMenuOpen(false)}>How it works</a><a href="#capabilities" onClick={()=>setMenuOpen(false)}>What it can do</a><a href="/login">Log in</a><a href="/login" className="rounded-full bg-[#24251f] px-4 py-3 text-center text-white">Meet your Pogo <ArrowRight className="ml-2 inline" size={14}/></a></div></div>}
      </nav>

      <section className="grain relative mx-auto grid max-w-[1440px] items-center gap-14 px-6 pb-24 pt-14 md:px-12 md:pb-32 md:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:px-16">
        <div className="relative z-10 max-w-[650px]">
          <motion.div initial="hidden" animate="visible" variants={rise} className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#dcd6c9] bg-white/40 px-3.5 py-2 text-[11px] tracking-wide text-[#66685a]"><span className="h-1.5 w-1.5 rounded-full bg-[#7c8860] breathe"/> A little help that goes a long way</motion.div>
          <motion.h1 initial="hidden" animate="visible" transition={{delay:.08}} variants={rise} className="display max-w-[680px] text-[clamp(4rem,8.4vw,7.7rem)] leading-[.91]">You have a lot going on. <span className="relative italic text-[#737b59]">Pogo</span> gets it.</motion.h1>
          <motion.p initial="hidden" animate="visible" transition={{delay:.18}} variants={rise} className="mt-8 max-w-[470px] text-[16px] leading-[1.8] text-[#77776d] md:text-[17px]">Your personal agent for the stuff you don’t have time to do. Just send a message. Pogo takes it from there.</motion.p>
          <motion.div initial="hidden" animate="visible" transition={{delay:.28}} variants={rise} className="mt-9 flex flex-wrap items-center gap-4"><a href="/login" className="group rounded-full bg-[#d97850] px-6 py-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(217,120,80,.22)] transition hover:-translate-y-1 hover:bg-[#c96a43]">Get your Pogo <ArrowRight className="ml-4 inline transition group-hover:translate-x-1" size={15}/></a><a href="#how" className="flex items-center gap-2 px-2 py-3 text-[13px] text-[#6d6e64] hover:text-[#24251f]">See how it works <ArrowDownRight size={15}/></a></motion.div>
          <div className="mt-14 flex items-center gap-4 border-t border-[#ded8cc] pt-6"><div className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f6f2e9] bg-[#d8b7a2] text-[10px]">✳</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f6f2e9] bg-[#b7bea0] text-[10px]">⌁</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f6f2e9] bg-[#e8c58e] text-[10px]">✦</span></div><p className="text-[11px] leading-relaxed text-[#858479]">Less juggling. More living.<br/><span className="text-[#55564d]">That’s the whole idea.</span></p></div>
        </div>
        <motion.div initial={{opacity:0,scale:.96,y:20}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.9,delay:.2,ease:[.22,1,.36,1]}} className="relative mx-auto w-full max-w-[530px] lg:ml-auto">
          <div className="absolute -left-12 top-10 h-32 w-32 rounded-full bg-[#e7d7bd] blur-3xl opacity-70"/>
          <div className="absolute -right-14 bottom-10 h-40 w-40 rounded-full bg-[#d6d9c2] blur-3xl opacity-80"/>
          <div className="relative rounded-[2.5rem] border border-[#e5dfd2] bg-[#eee9df] p-5 md:p-8">
            <div className="mb-5 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#8a887d]">A peek at Pogo</span><span className="rounded-full bg-[#dce2d0] px-3 py-1 text-[10px] text-[#65704e]">real life, less admin</span></div>
            <PhoneDemo/>
            <div className="mt-5 flex items-center justify-between px-1 text-[10px] text-[#89877c]"><span>One message. A few things off your plate.</span><span>↗</span></div>
          </div>
          <div className="absolute -bottom-7 -left-8 hidden rounded-2xl border border-[#e5dfd2] bg-[#fffdf8] px-4 py-3 shadow-lg md:block"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#f3e2d8] text-[#c96f4b]"><Zap size={14}/></span><div><p className="text-[11px] font-semibold">You do you.</p><p className="text-[10px] text-[#8b897e]">Pogo handles the rest.</p></div></div></div>
        </motion.div>
      </section>

      <section id="how" className="bg-[#24251f] px-6 py-24 text-[#f6f2e9] md:px-12 md:py-32 lg:px-16">
        <div className="mx-auto max-w-[1280px]"><div className="grid gap-10 md:grid-cols-[.8fr_1.2fr] md:items-end"><div><p className="mb-5 text-[10px] font-semibold uppercase tracking-[.22em] text-[#b9bd9e]">The simple version</p><h2 className="display text-5xl leading-[.98] md:text-7xl">Say it.<br/><span className="italic text-[#c4c9a7]">Pogo does it.</span></h2></div><p className="max-w-[430px] pb-2 text-[15px] leading-[1.8] text-[#c0c0b5]">No new complicated workflow. No dashboard you have to babysit. Just a message to your Pogo, and a little more room in your day.</p></div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
            {[{n:"01",title:"Tell Pogo what’s up",desc:"Send a message like you’d send one to a friend. No special commands or magic words.",icon:<MessageCircle size={20}/>},{n:"02",title:"Pogo gets to work",desc:"It figures out the steps, uses the services you connect, and keeps you in the loop.",icon:<Command size={20}/>},{n:"03",title:"You stay in control",desc:"Get updates, review important actions, and see what actually got done.",icon:<ShieldCheck size={20}/>}].map((item)=><div key={item.n} className="bg-[#2b2c25] p-8 md:p-10"><div className="mb-14 flex items-center justify-between"><span className="text-xs text-[#a8ad8d]">{item.n} / 03</span><span className="text-[#c4c9a7]">{item.icon}</span></div><h3 className="display text-3xl">{item.title}</h3><p className="mt-4 max-w-[280px] text-[13px] leading-[1.8] text-[#b5b6aa]">{item.desc}</p></div>)}
          </div>
        </div>
      </section>

      <section id="capabilities" className="px-6 py-24 md:px-12 md:py-32 lg:px-16">
        <div className="mx-auto max-w-[1280px]"><div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="mb-5 text-[10px] font-semibold uppercase tracking-[.22em] text-[#8b8b7b]">More than a chat</p><h2 className="display max-w-[650px] text-5xl leading-[1] md:text-7xl">A helping hand<br/>that <span className="italic text-[#737b59]">follows through.</span></h2></div><p className="max-w-[330px] text-[14px] leading-[1.8] text-[#77776d]">The little things, the big things, and all the things that somehow end up on your list.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] bg-[#e9e5d9] p-8 md:p-10"><div className="relative z-10 max-w-[310px]"><span className="mb-8 inline-grid h-10 w-10 place-items-center rounded-xl bg-[#d8ddca] text-[#65704e]"><Clock3 size={18}/></span><h3 className="display text-4xl">Keep life moving.</h3><p className="mt-4 text-[13px] leading-[1.8] text-[#77776d]">Coordinate plans, stay on top of follow-ups, and get the everyday admin out of your head.</p></div><div className="absolute -bottom-10 -right-5 h-56 w-56 rounded-full border-[1px] border-[#aeb79a] opacity-70"/><div className="absolute -bottom-1 right-8 h-40 w-40 rounded-full border-[1px] border-[#aeb79a] opacity-70"/><div className="absolute bottom-16 right-16 h-24 w-24 rounded-full bg-[#cdd4ba] opacity-80"/></div>
            <div className="relative min-h-[310px] overflow-hidden rounded-[2rem] bg-[#e6d7ca] p-8 md:p-10"><div className="relative z-10 max-w-[310px]"><span className="mb-8 inline-grid h-10 w-10 place-items-center rounded-xl bg-[#f4e8dc] text-[#b96848]"><Sparkles size={18}/></span><h3 className="display text-4xl">Make things happen.</h3><p className="mt-4 text-[13px] leading-[1.8] text-[#786c63]">Research options, prepare messages, organize information, and take action with your say-so.</p></div><div className="absolute -right-4 -top-5 h-56 w-56 rotate-12 rounded-[3rem] border border-[#c9a995]"/><div className="absolute -right-1 top-10 h-40 w-40 rotate-12 rounded-[2.5rem] border border-[#c9a995]"/><div className="absolute right-12 top-24 h-20 w-20 rotate-12 rounded-[1.7rem] bg-[#d8b9a4]"/></div>
          </div>
        </div>
      </section>

      <section id="trust" className="border-y border-[#ded8cc] bg-[#efebe1] px-6 py-20 md:px-12 md:py-24 lg:px-16"><div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-[1fr_1fr] md:items-center"><div><p className="mb-5 text-[10px] font-semibold uppercase tracking-[.22em] text-[#8b8b7b]">Your say, always</p><h2 className="display text-5xl leading-[1.02] md:text-6xl">Helpful, not<br/><span className="italic text-[#737b59]">out of control.</span></h2></div><div className="grid gap-5 sm:grid-cols-2"><div className="flex gap-3"><span className="mt-1 text-[#737b59]"><ShieldCheck size={19}/></span><div><h3 className="text-sm font-semibold">You choose access</h3><p className="mt-2 text-xs leading-[1.8] text-[#77776d]">Connect only the services you want. Set permissions that make sense to you.</p></div></div><div className="flex gap-3"><span className="mt-1 text-[#737b59]"><Check size={19}/></span><div><h3 className="text-sm font-semibold">Approvals when it matters</h3><p className="mt-2 text-xs leading-[1.8] text-[#77776d]">Review sensitive actions before Pogo takes them.</p></div></div><div className="flex gap-3"><span className="mt-1 text-[#737b59]"><Clock3 size={19}/></span><div><h3 className="text-sm font-semibold">A clear activity trail</h3><p className="mt-2 text-xs leading-[1.8] text-[#77776d]">See what Pogo tried, what worked, and what still needs you.</p></div></div><div className="flex gap-3"><span className="mt-1 text-[#737b59]"><MessageCircle size={19}/></span><div><h3 className="text-sm font-semibold">No mystery moves</h3><p className="mt-2 text-xs leading-[1.8] text-[#77776d]">Pogo should explain what it’s doing, not leave you guessing.</p></div></div></div></div></section>

      <section className="px-6 py-24 md:px-12 md:py-32 lg:px-16"><div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[2.5rem] bg-[#737b59] px-8 py-16 text-center text-[#fbf8f0] md:px-16 md:py-24"><div className="absolute -left-20 -top-32 h-80 w-80 rounded-full border border-white/15"/><div className="absolute -right-10 -bottom-40 h-96 w-96 rounded-full border border-white/15"/><div className="relative"><p className="mb-6 text-[10px] font-semibold uppercase tracking-[.22em] text-[#e0e4d2]">A little less on your plate</p><h2 className="display mx-auto max-w-[760px] text-5xl leading-[.98] md:text-7xl">Go do your thing.<br/><span className="italic text-[#e0e4d2]">Pogo’s got this.</span></h2><a href="/login" className="mt-9 inline-flex items-center rounded-full bg-[#fbf8f0] px-6 py-4 text-[13px] font-semibold text-[#34372c] transition hover:-translate-y-1">Get started <ArrowRight className="ml-4" size={15}/></a></div></div></section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-5 border-t border-[#ded8cc] px-6 py-8 text-[11px] text-[#858479] md:flex-row md:items-center md:justify-between md:px-12 lg:px-16"><a href="#" className="flex items-center gap-2 font-semibold text-[#33342d]"><Mark small/> pogo</a><p>Made for the things that make up your day.</p><div className="flex gap-5"><a href="/privacy" className="hover:text-[#24251f]">Privacy</a><a href="/terms" className="hover:text-[#24251f]">Terms</a><span>© 2026 Pogo</span></div></footer>
    </main>
  );
}