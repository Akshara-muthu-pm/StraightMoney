"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, USE_MOCKS } from "@/lib/api";
import { campaignImagery } from "@/lib/campaign-imagery";
import { money, totalFunded } from "@/lib/presentation";
import type { Campaign } from "@/lib/types";
import PayPalDonateButton from "@/components/PayPalDonateButton";
import ProgressBar from "@/components/ProgressBar";

export default function StartupCampaignDetail({ id }: { id: number }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.getCampaign(id).then((item) => { if (active) { if (/startup|venture|drone|aerodrone|robotics|prototype|hardware/i.test(`${item.title} ${item.description ?? ""}`)) { setCampaign(item); setState("ready"); } else setState("error"); } }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [id]);

  if (state === "loading") return <main id="main-content" tabIndex={-1} className="page-width py-16"><p role="status">Loading startup campaign…</p></main>;
  if (state === "error" || !campaign) return <main id="main-content" tabIndex={-1} className="page-width py-16"><h1 className="text-2xl font-bold">Campaign unavailable</h1><Link href="/explore/startups" className="mt-4 inline-block text-[#003087]">Back to startups</Link></main>;

  const funded = totalFunded(campaign);
  const image = /drone|aerodrone/i.test(campaign.title) ? { src: "/images/hero-planning.jpg", alt: "Illustrative startup planning session" } : campaignImagery(campaign.title, "detail");
  return (
    <main id="main-content" tabIndex={-1} className="page-width pb-20 pt-8 sm:pt-12">
      <Link href="/explore/startups" className="text-sm font-semibold text-[#003087] dark:text-sky-300">&larr; Startups</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)] lg:items-start">
        <div className="min-w-0">
          <header className="overflow-hidden rounded-[2rem] bg-[#001435] text-white">
            <div className="relative h-64 bg-slate-800 sm:h-80"><Image src={image.src} alt={image.alt} fill priority sizes="(max-width: 1024px) 100vw, 65vw" className="object-cover" /><span className="absolute bottom-3 left-3 rounded-md bg-black/75 px-2 py-1 text-xs">Illustrative photo</span></div>
            <div className="p-7 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#FFC439]">Startup campaign · {campaign.status}</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{campaign.title}</h1>
              <p className="mt-3 text-sm text-blue-200">Organized by {campaign.organizer_name}</p>
              {campaign.description && <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100">{campaign.description}</p>}
            </div>
          </header>

          <section className="mt-9" aria-labelledby="startup-budget-heading">
            <h2 id="startup-budget-heading" className="text-2xl font-bold text-[#001435] dark:text-white">Supplier milestones</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">These budget lines show the planned supplier spend. See the public ledger for actual payments.</p>
            <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {campaign.budget_lines.map((line, index) => <div key={line.id} className="flex items-start gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-[#003087] dark:bg-slate-800 dark:text-sky-300">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1"><h3 className="font-semibold text-[#001435] dark:text-white">{line.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{line.vendor_name ?? "Vendor assignment pending"}</p>{line.paid_amount > 0 && <p className="mt-1 text-xs text-emerald-700">{money(line.paid_amount, campaign.currency)} paid</p>}</div>
                <strong className="text-sm text-[#003087] dark:text-sky-300">{money(line.budgeted_amount, campaign.currency)}</strong>
              </div>)}
            </div>
          </section>

          <div className="mt-7 flex flex-wrap gap-5 text-sm font-semibold text-[#003087] dark:text-sky-300"><Link href={`/ledger/${campaign.id}`}>View transactions</Link>{!USE_MOCKS && <a href={api.campaignReportUrl(campaign.id)}>Download report</a>}</div>
        </div>

        <aside id="donate" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-20">
          <span className="text-xs font-bold uppercase tracking-[.16em] text-[#0070BA]">Back this venture</span>
          <h2 className="mt-2 text-xl font-bold text-[#001435] dark:text-white">Help fund the next milestone</h2>
          <p className="mt-5 text-2xl font-bold text-[#001435] dark:text-white">{money(funded, campaign.currency)} <span className="text-sm font-normal text-slate-500">of {money(campaign.goal_amount, campaign.currency)}</span></p>
          <div className="mt-3"><ProgressBar current={funded} goal={campaign.goal_amount} /></div>
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            {campaign.status === "active" ? <PayPalDonateButton campaignId={campaign.id} campaignTitle={campaign.title} currency={campaign.currency} progressHref={`/explore/startups/${campaign.id}`} onCaptured={async () => setCampaign(await api.getCampaign(id))} /> : <p role="status" className="text-sm text-slate-600">This campaign is not accepting donations.</p>}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">Payments use PayPal Sandbox. Supplier payments appear in the public ledger when confirmed.</p>
        </aside>
      </div>
    </main>
  );
}
