"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { money, totalFunded } from "@/lib/presentation";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import ProjectUpdates from "./ProjectUpdates";
import { campaignImagery } from "@/lib/campaign-imagery";

export default function CampaignExplore() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api.listCampaigns().then((items) => Promise.all(items.filter((item) => item.status !== "draft").map((item) => api.getCampaign(item.id)))).then((items) => { if (active) setCampaigns(items.sort((a, b) => Number(b.title.toLowerCase().includes("library")) - Number(a.title.toLowerCase().includes("library")))); }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load campaigns."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const featured = campaigns[0];
  return <>
    <section id="campaigns" className="section-space" aria-labelledby="explore-title"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Good things start close to home</p><h2 id="explore-title" className="display-heading mt-3 text-4xl sm:text-5xl">Find a corner to brighten.</h2></div><span className="rounded-full border border-brand-200 px-4 py-2 text-xs font-semibold text-brand-800">{USE_MOCKS ? "Sample campaigns" : "Community campaigns"}</span></div>
      {loading && <p role="status" className="surface-card p-6">Loading community campaigns...</p>}
      {error && <div role="alert" className="surface-card p-6"><p>{error}</p><button type="button" className="button-secondary mt-4" onClick={() => { setLoading(true); setError(""); setRetry((value) => value + 1); }}>Try again</button></div>}
      {!loading && !error && campaigns.length === 0 && <p className="surface-card p-6">New community campaigns will appear here when they are published.</p>}
      <div className="space-y-6">{campaigns.map((campaign, index) => <article className="surface-card grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]" key={campaign.id}><div className="relative min-h-72 bg-brand-100"><Image src={campaignImagery(campaign.title).src} alt={campaignImagery(campaign.title).alt} fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" /><span className="photo-label">Illustrative photo / not project evidence</span></div><div className="p-6 sm:p-9"><div className="flex items-center justify-between gap-4"><p className="eyebrow">{index === 0 ? "Featured community campaign" : "Community campaign"}</p><StatusBadge status={campaign.status} /></div><h3 className="display-heading mt-4 text-4xl">{campaign.title}</h3><p className="mt-4 text-sm leading-7 text-slate-600">{campaign.description}</p><p className="mt-3 text-xs text-slate-500">Organized by {campaign.organizer_name}</p><div className="mt-6"><ProgressBar current={totalFunded(campaign)} goal={campaign.goal_amount} /><p className="mt-3 text-sm"><strong>{money(totalFunded(campaign), campaign.currency)}</strong> funded of {money(campaign.goal_amount, campaign.currency)}</p><p className="mt-1 text-xs text-slate-500">Includes available funds and completed vendor payouts.</p></div><div className="mt-6 flex flex-wrap gap-3"><Link href={`/campaigns/${campaign.id}#campaign-story`} className="button-primary">Read the story</Link><Link href={`/campaigns/${campaign.id}#donate`} className="button-secondary">Donate</Link><Link href={`/ledger/${campaign.id}`} className="inline-flex items-center p-2 text-sm font-semibold text-brand-800 underline">Public ledger</Link></div></div></article>)}</div>
    </section>
    {featured && <ProjectUpdates key={featured.id} campaignId={featured.id} />}
  </>;
}
