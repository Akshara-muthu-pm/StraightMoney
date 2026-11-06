"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import { campaignImagery } from "@/lib/campaign-imagery";
import { money, totalFunded } from "@/lib/presentation";
import type { Campaign } from "@/lib/types";
import ProgressBar from "@/components/ProgressBar";

const isStartup = (campaign: Campaign) => /startup|venture|drone|aerodrone|robotics|prototype|hardware/i.test(`${campaign.title} ${campaign.description ?? ""}`);

export default function LiveStartupCards() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api.listCampaigns()
      .then((items) => Promise.all(items.filter((item) => item.status !== "draft").map((item) => api.getCampaign(item.id))))
      .then((items) => { if (active) { setCampaigns(items.filter(isStartup)); setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  return (
    <section id="live-startups" className="mt-16 scroll-mt-24" aria-labelledby="live-startups-title">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#0070BA]">Available to support</p>
      <h2 id="live-startups-title" className="mt-2 text-3xl font-bold tracking-tight text-[#001435] dark:text-white sm:text-4xl">Startup campaigns</h2>
      {state === "loading" && <p role="status" className="mt-6 text-sm text-slate-600">Loading startup campaigns…</p>}
      {state === "error" && <p role="status" className="mt-6 text-sm text-slate-600">Campaigns are unavailable right now. Please try again later.</p>}
      {state === "ready" && campaigns.length === 0 && <p className="mt-6 text-sm text-slate-600">No startup campaigns are published yet.</p>}
      {state === "ready" && campaigns.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2">
        {campaigns.map((campaign) => {
          const funded = totalFunded(campaign);
          const image = /drone|aerodrone/i.test(campaign.title) ? { src: "/images/hero-planning.jpg", alt: "Illustrative startup planning session" } : campaignImagery(campaign.title, "card");
          return <article key={campaign.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[.8fr_1.2fr]">
            <div className="relative min-h-52 bg-slate-100"><Image src={image.src} alt={image.alt} fill sizes="(max-width: 640px) 100vw, 40vw" className="object-cover" /></div>
            <div className="flex flex-col p-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#0070BA]">{campaign.status === "active" ? "Accepting support" : "Campaign closed"}</span>
              <h3 className="mt-2 text-xl font-bold text-[#001435] dark:text-white">{campaign.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{campaign.description}</p>
              <div className="mt-auto pt-5"><ProgressBar current={funded} goal={campaign.goal_amount} /><p className="mt-2 text-xs text-slate-500">{money(funded, campaign.currency)} raised of {money(campaign.goal_amount, campaign.currency)}</p></div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/explore/startups/${campaign.id}`} className="inline-flex items-center rounded-full border border-[#003087] px-4 py-2 text-xs font-bold text-[#003087] dark:border-sky-300 dark:text-sky-300">View startup</Link>
                {campaign.status === "active" && <Link href={`/explore/startups/${campaign.id}#donate`} className="inline-flex items-center rounded-full bg-[#FFC439] px-4 py-2 text-xs font-bold text-[#001435] hover:bg-[#ffd566]">Donate via PayPal &rarr;</Link>}
              </div>
            </div>
          </article>;
        })}
      </div>}
    </section>
  );
}
