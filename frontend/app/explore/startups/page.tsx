import Image from "next/image";
import Link from "next/link";
import LiveStartupCards from "@/components/LiveStartupCards";

export default function StartupsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-width pb-20 pt-8 sm:pt-12">
      <Link href="/explore" className="text-sm font-semibold text-[#003087] hover:text-[#0070BA] dark:text-sky-300">&larr; Explore</Link>

      <section className="relative mt-7 overflow-hidden rounded-[2rem] bg-[#001435] text-white shadow-xl" aria-labelledby="startup-title">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(186,224,252,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(186,224,252,.12) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="px-7 pb-8 pt-10 sm:px-12 sm:py-14">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#FFC439]"><span className="h-2 w-2 rounded-full bg-[#FFC439]" /> StraightMoney for startups</span>
            <h1 id="startup-title" className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Back the build.<br /><span className="text-[#BAE0FC]">See the milestones.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">Support a published venture and see its supplier budget before you contribute.</p>
            <a href="#live-startups" className="mt-8 inline-flex items-center rounded-full bg-[#FFC439] px-6 py-3 text-sm font-bold text-[#001435] transition hover:bg-[#ffd566]">Browse startup campaigns &rarr;</a>
            <p className="mt-6 text-xs text-blue-200">PayPal Sandbox campaigns</p>
          </div>
          <div className="relative min-h-72 self-stretch lg:min-h-[430px]">
            <Image src="/images/hero-planning.jpg" alt="Team planning a startup project" fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#001435] via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#001435] lg:via-transparent lg:to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/25 bg-[#001435]/80 p-4 backdrop-blur-md sm:left-auto sm:w-64">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#FFC439]">Funding path</span>
              <p className="mt-2 text-sm font-semibold">Backer &rarr; campaign &rarr; verified supplier</p>
            </div>
          </div>
        </div>
      </section>

      <LiveStartupCards />

      <section className="mt-12 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-[#f2f8fd] p-7 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div><h2 className="text-xl font-bold text-[#001435] dark:text-white">Building something of your own?</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create a campaign with supplier budgets and trackable milestones.</p></div>
        <Link href="/signin" className="inline-flex shrink-0 justify-center rounded-full bg-[#003087] px-6 py-3 text-sm font-bold text-white hover:bg-[#00457C]">Get started &rarr;</Link>
      </section>
    </main>
  );
}
