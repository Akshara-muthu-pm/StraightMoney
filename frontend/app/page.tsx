import ImpactExperience from "@/components/ImpactExperience";
import Link from "next/link";
import FundsJourney from "@/components/FundsJourney";

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1} className="home-page">
      <section
        className="page-width grid items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:py-14"
        aria-labelledby="hero-title"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0070BA] dark:text-sky-300">Community fundraising</p>
          <h1
            id="hero-title"
            className="mt-5 text-[clamp(2.7rem,5.2vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-[#001435]"
          >
            Give with clarity.<br />
            <span className="text-[#0070BA] dark:text-sky-300">
              Follow every payout.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
            Support projects with published budgets, reviewed invoices, and confirmed vendor payments.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3.5">
            <Link href="/explore" className="button-primary text-sm">
              Explore campaigns
            </Link>
            <Link href="#how-it-works" className="button-secondary text-sm">
              How funds move &rarr;
            </Link>
          </div>

        </div>
        <ImpactExperience />
      </section>

      <div className="page-width">
        <FundsJourney />
        
        <section
          className="liquid-glass-dark mb-12 p-8 sm:p-12 text-white relative overflow-hidden"
          aria-labelledby="transparency-title"
        >
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
            <div>
              <h2 id="transparency-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                See where every dollar goes.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-blue-100">
                Every campaign has a public ledger of captured PayPal donations and confirmed vendor disbursements, with direct links to delivery evidence. Inspect every dollar before signing in.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/explore" className="button-gold text-xs font-bold">
                  Explore campaigns &amp; view ledger
                </Link>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-blue-100">Open a campaign to see its budget, payment status, and public ledger.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
