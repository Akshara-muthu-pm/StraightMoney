import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Explore Campaigns | StraightMoney",
  description:
    "Choose your exploration path on StraightMoney: Browse verified public causes or explore milestone-governed startup campaigns.",
};

const paths = [
  {
    id: "public-causes",
    href: "/explore/public-causes",
    title: "Public Causes",
    eyebrow: "COMMUNITY & CIVIC",
    tagline: "Give a community idea room to grow.",
    description:
      "Browse local and civic initiatives with published budgets, verified invoices, and a live public ledger of confirmed vendor payments. Organizers never hold the money.",
    badge: "ACTIVE IN SANDBOX",
    badgeColor: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:ring-emerald-800",
    image: "/images/community-volunteers.jpg",
    imageAlt: "Volunteers carrying boxes and working together in a community initiative",
    number: "01",
    action: "Browse Public Causes",
    features: [
      "Published Line-Item Budgets (Shelves, Books, Paint)",
      "Gemini OCR + 8 Strict Python Policy Checks",
      "Human Verifier Approval Before Payment",
      "Immutable Public Spending Ledger with Proof Photos",
    ],
    stats: "Live Campaign: School Library Corner ($1,200 Goal)",
    primaryCta: true,
  },
  {
    id: "startups",
    href: "/explore/startups",
    title: "Startups & Ventures",
    eyebrow: "EMERGING VENTURES & INNOVATION",
    tagline: "Follow ideas taking their first steps.",
    description:
      "A dedicated space for early-stage builders and hardware ventures. Backers fund milestone escrow pools where capital is released directly to suppliers only upon verified milestone delivery.",
    badge: "COMING SOON &middot; BETA",
    badgeColor: "bg-[#FFC439]/20 text-[#8C5F00] ring-[#FFC439]/50 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-800",
    image: "/images/hero-planning.jpg",
    imageAlt: "A group of startup founders planning together around blueprints and prototypes",
    number: "02",
    action: "Explore Startups",
    features: [
      "Milestone-Governed Escrow via PayPal",
      "Direct Supplier & Prototyping Lab Disbursements",
      "Deliverable Validation Before Fund Release",
      "Early-Access Backer Community",
    ],
    stats: "Milestone Escrow Framework &middot; Early Access",
    primaryCta: false,
  },
];

export default function ExploreGatewayPage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-width py-10 sm:py-16">
      {/* Header Banner */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200/90 bg-white/90 px-4 py-1.5 text-xs font-black tracking-wider text-[#003087] shadow-sm backdrop-blur-md dark:border-blue-900/80 dark:bg-slate-800/90 dark:text-blue-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0070BA] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0070BA]" />
          </span>
          WHERE WOULD YOU LIKE TO MAKE AN IMPACT?
        </div>

        <h1 className="display-heading mt-6 text-4xl sm:text-5xl lg:text-6xl text-[#001435] dark:text-white">
          Choose your exploration path.
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
          StraightMoney protects every contribution by locking funds to itemized vendor budgets. Select which path you want to explore today.
        </p>
      </div>

      {/* Two Exploration Options Grid */}
      <section
        className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-stretch"
        aria-label="Campaign types"
      >
        {paths.map((path) => (
          <div
            key={path.id}
            className="surface-card group relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/80 p-0 shadow-xl shadow-blue-950/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-blue-950/15 dark:border-slate-800"
          >
            <div>
              {/* Card Image Banner */}
              <div className="relative h-64 w-full overflow-hidden bg-slate-100 sm:h-72">
                <Image
                  src={path.image}
                  alt={path.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/80 via-[#001435]/30 to-transparent" />

                {/* Floating Badges */}
                <div className="absolute left-5 top-5 flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ring-1 backdrop-blur-md ${path.badgeColor}`}
                  >
                    {path.badge}
                  </span>
                </div>

                <div className="absolute right-5 top-5 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs font-black text-white backdrop-blur-md">
                  {path.number}
                </div>

                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#BAE0FC]">
                    {path.eyebrow}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl text-white">
                    {path.title}
                  </h2>
                </div>
              </div>

              {/* Card Body Content */}
              <div className="p-6 sm:p-8">
                <p className="text-base font-bold text-[#001435] dark:text-white">
                  {path.tagline}
                </p>

                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {path.description}
                </p>

                {/* Features Checklist */}
                <div className="mt-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    What to expect in this space:
                  </p>
                  <ul className="space-y-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {path.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-[#003087] dark:bg-blue-950 dark:text-blue-300">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Card Footer with CTA */}
            <div className="border-t border-slate-100/90 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {path.stats}
                </span>

                <Link
                  href={path.href}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black shadow-md transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    path.primaryCta
                      ? "button-gold shadow-[#FFC439]/30 hover:shadow-[#FFC439]/50"
                      : "button-primary shadow-blue-900/20"
                  }`}
                >
                  {path.action} <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Trust & Guarantee Banner */}
      <section className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-[2rem] border border-white/80 bg-gradient-to-r from-blue-50/70 via-white/80 to-sky-50/70 p-6 text-center shadow-sm backdrop-blur-md dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 sm:p-8">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-[#003087] dark:text-[#38bdf8]">
          <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
          The StraightMoney Guarantee
        </div>
        <h3 className="mt-2 text-lg font-black text-[#001435] dark:text-white sm:text-xl">
          Whichever path you choose, organizers never hold the money.
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Contributions remain locked in PayPal Sandbox balance. Funds disburse only directly to registered vendors and suppliers upon verified invoice approval.
        </p>
      </section>
    </main>
  );
}
