import ImpactExperience from "@/components/ImpactExperience";
import Link from "next/link";
import CampaignExplore from "@/components/CampaignExplore";
import HomeHighlights from "@/components/HomeHighlights";
import OurIdea from "@/components/OurIdea";
import FundsJourney from "@/components/FundsJourney";

export default function HomePage() {
  return <main id="main-content" tabIndex={-1}>
    <section className="page-width grid items-center gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-16" aria-labelledby="hero-title">
      <div><p className="eyebrow flex items-center gap-3"><span className="h-px w-8 bg-brand-400" />A brighter corner of the community</p><h1 id="hero-title" className="display-heading mt-6 text-[clamp(3rem,6.1vw,5.4rem)] leading-[1.06]">Small acts of giving.<br /><em className="font-normal text-brand-700">Brighter tomorrows.</em></h1><p className="mt-6 max-w-md text-base leading-8 text-slate-600">Help communities bring meaningful projects to life. Choose a cause, contribute what you can, and follow how your generosity reaches the people doing the work.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="#campaigns" className="button-primary">Explore campaigns</Link><Link href="#how-it-works" className="button-secondary">How it works</Link></div><p className="mt-7 text-xs text-slate-600">Community projects. Human review. Open records.</p></div>
      <ImpactExperience />
    </section>
    <div className="border-y border-brand-200/60 bg-brand-50/60"><div className="page-width flex flex-wrap justify-between gap-4 py-5 text-xs font-semibold tracking-wide text-brand-900"><span>Purpose in every contribution</span><span>Human-reviewed invoices</span><span>Direct vendor payouts</span><span>A public spending ledger</span></div></div>
    <div className="page-width">
      <OurIdea />
      <HomeHighlights />
      <FundsJourney />
      <CampaignExplore />
      <section className="transparency-panel mb-16 rounded-[2rem] p-7 sm:p-12" aria-labelledby="transparency-title"><div><p className="eyebrow text-brand-200">Generosity deserves clarity</p><h2 id="transparency-title" className="display-heading mt-4 text-4xl sm:text-5xl">See where the good goes.</h2><p className="mt-5 max-w-lg leading-8 text-brand-100">Every campaign has a public ledger of donations and vendor payouts, with links to evidence when available. Browse the story and the spending before signing in.</p><Link href="#campaigns" className="button-light mt-7">Choose a campaign & view its ledger</Link></div><div className="border-l border-white/20 pl-6 text-sm leading-8 text-brand-100"><p>Budgeted before spending.</p><p>Reviewed before payout.</p><p>Confirmed before marked paid.</p></div></section>
    </div>
  </main>;
}
