import ImpactExperience from "@/components/ImpactExperience";
import Link from "next/link";
import CampaignExplore from "@/components/CampaignExplore";
import HomeHighlights from "@/components/HomeHighlights";
import OurIdea from "@/components/OurIdea";
import FundsJourney from "@/components/FundsJourney";

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <section
        className="page-width grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1.05fr] lg:gap-14 lg:py-16"
        aria-labelledby="hero-title"
      >
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-white/80 px-4 py-1.5 text-xs font-black tracking-wider text-[#003087] shadow-sm backdrop-blur-xl ring-1 ring-blue-900/5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0070BA] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0070BA]"></span>
            </span>
            ZERO-CUSTODY ESCROW &middot; PAYPAL AI HACKATHON
          </div>
          <h1
            id="hero-title"
            className="mt-6 text-[clamp(2.7rem,5.6vw,4.8rem)] font-extrabold leading-[1.08] tracking-tight text-[#001435]"
          >
            Transparent giving.<br />
            <span className="bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#009CDE] bg-clip-text text-transparent">
              Direct vendor payouts.
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600">
            Fund community projects where organizers never hold the money. Donors contribute via PayPal Orders v2 into verified escrow, vendors submit invoices with delivery evidence, Gemini AI audits policy compliance, and reviewers approve tracked PayPal Payouts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link href="#campaigns" className="button-primary shadow-lg shadow-blue-950/20 text-sm">
              Explore campaigns
            </Link>
            <Link href="#how-it-works" className="button-secondary text-sm">
              How funds move &rarr;
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["PayPal Orders v2", "Escrow Vault", "#003087"],
              ["Gemini AI Checks", "Document Audit", "#0070BA"],
              ["PayPal Payouts", "Direct to Vendor", "#10B981"],
              ["Public Ledger", "Zero Custody Leak", "#FFC439"]
            ].map(([title, subtitle, accent]) => (
              <div key={title} className="rounded-2xl border border-white/90 bg-white/70 p-3 shadow-sm backdrop-blur-md transition hover:border-blue-200">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
                  <strong className="text-[11px] font-black text-[#001435]">{title}</strong>
                </span>
                <span className="mt-1 block text-[10px] font-semibold text-slate-500">{subtitle}</span>
              </div>
            ))}
          </div>
        </div>
        <ImpactExperience />
      </section>

      <div className="page-width">
        <CampaignExplore />
      </div>

      <div className="border-y border-white/80 bg-white/50 backdrop-blur-xl shadow-sm">
        <div className="page-width flex flex-wrap justify-between gap-4 py-4 text-xs font-black tracking-wider text-[#003087]">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            Purpose in every contribution
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            Gemini &amp; Policy Checked Invoices
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            Direct PayPal Vendor Payouts
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            Immutable Public Spending Ledger
          </span>
        </div>
      </div>

      <div className="page-width">
        <OurIdea />
        <HomeHighlights />
        <FundsJourney />
        
        <section
          className="liquid-glass-dark mb-20 rounded-[2.8rem] p-8 sm:p-14 text-white shadow-2xl relative overflow-hidden"
          aria-labelledby="transparency-title"
        >
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-extrabold text-[#BAE0FC] backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-[#FFC439]" />
                IMMUTABLE AUDIT TRAIL
              </div>
              <h2 id="transparency-title" className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
                See where every dollar goes.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-blue-100">
                Every campaign has a public ledger of captured PayPal donations and confirmed vendor disbursements, with direct links to delivery evidence. Inspect every dollar before signing in.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="#campaigns" className="button-gold text-xs font-black shadow-lg shadow-[#FFC439]/30 hover:scale-105">
                  Explore campaigns &amp; view ledger
                </Link>
                <Link href="/ledger/1" className="button-secondary text-xs font-bold text-white border-white/30 bg-white/15 hover:bg-white/25">
                  Open live public ledger &rarr;
                </Link>
              </div>
            </div>

            <div className="space-y-3.5">
              {[
                ["Budgeted Before Spending", "Every dollar collected is earmarked for explicit vendor budget items before any invoice is approved."],
                ["AI & Human Reviewed", "Gemini AI checks OCR totals and delivery proofs, while human verifiers make final payment decisions."],
                ["PayPal Confirmed Payouts", "Direct payouts are sent via PayPal Payouts API. No funds are marked paid until PayPal confirms transfer."]
              ].map(([heading, desc]) => (
                <div key={heading} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md shadow-inner transition hover:bg-white/15">
                  <p className="flex items-center gap-2 text-xs font-black tracking-wide text-white">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#009CDE] text-white text-[10px] font-black">
                      ✓
                    </span>
                    {heading}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-100/90 pl-7">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
