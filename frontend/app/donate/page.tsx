"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PayPalDonateButton from "@/components/PayPalDonateButton";
import { api } from "@/lib/api";
import { money } from "@/lib/presentation";
import type { CampaignSummary } from "@/lib/types";

export default function DonatePage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    let active = true;
    api.listCampaigns().then((items) => { if (active) setCampaigns(items.filter((item) => item.status === "active")); }).catch(() => { if (active) setError("We couldn’t load campaigns right now. Please try again."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const campaign = campaigns.find((item) => item.id === selectedId) ?? campaigns[0];
  const refresh = async () => {
    if (!campaign) return;
    const updated = await api.getCampaign(campaign.id);
    setCampaigns((items) => items.map((item) => item.id === updated.id ? updated : item));
  };
  return <main id="main-content" tabIndex={-1} className="page-width py-10">
    <p className="eyebrow">Put your generosity into action</p><h1 className="display-heading mt-4 text-4xl sm:text-5xl">Make a contribution.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-700">Choose the project you want to support, then enter your contribution below. You can read its story and inspect its spending before you give.</p>
    {loading && <p role="status" className="surface-card mt-8 p-6">Loading campaigns accepting contributions...</p>}
    {error && <div role="alert" className="surface-card mt-8 p-6"><p>{error}</p><button type="button" className="button-secondary mt-4" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Try again</button></div>}
    {!loading && !error && !campaign && <div className="surface-card mt-8 p-6"><p>No campaigns are currently accepting contributions.</p><Link href="/#campaigns" className="button-secondary mt-4">Explore campaigns</Link></div>}
    {!loading && !error && campaign && <div className="mt-9 grid items-start gap-7 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="surface-card p-6 sm:p-8" aria-labelledby="donation-form-title"><h2 id="donation-form-title" className="mb-5 text-xl font-bold">Choose where your donation goes</h2><label className="mb-6 block text-sm font-semibold">Campaign<select value={campaign.id} onChange={(event) => setSelectedId(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">{campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><PayPalDonateButton key={campaign.id} campaignId={campaign.id} campaignTitle={campaign.title} currency={campaign.currency} progressHref={`/campaigns/${campaign.id}#updates`} onCaptured={refresh} /></section>
      <aside className="surface-card p-6 sm:p-8"><p className="eyebrow">Your selected project</p><h2 className="display-heading mt-3 text-3xl">{campaign.title}</h2><p className="mt-4 text-sm leading-7 text-slate-700">{campaign.description}</p><dl className="mt-6 grid grid-cols-2 gap-4"><div><dt className="text-xs text-slate-600">Campaign goal</dt><dd className="mt-2 font-bold">{money(campaign.goal_amount, campaign.currency)}</dd></div><div><dt className="text-xs text-slate-600">Available funds</dt><dd className="mt-2 font-bold">{money(campaign.pool_balance, campaign.currency)}</dd></div></dl><div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold text-brand-800"><Link href={`/campaigns/${campaign.id}#campaign-story`} className="underline">Read the story</Link><Link href={`/ledger/${campaign.id}`} className="underline">View public ledger</Link></div><p className="mt-6 border-t border-slate-200 pt-5 text-sm leading-7 text-slate-600">A verifier reviews vendor invoices and delivery evidence before approving eligible payouts.</p></aside>
    </div>}
  </main>;
}
