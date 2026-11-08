"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { money, totalFunded } from "@/lib/presentation";
import { campaignImagery } from "@/lib/campaign-imagery";
import { isStartupCampaign } from "@/lib/campaign-category";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

export default function CampaignExplore() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    api.listCampaigns()
      .then((items) => Promise.all(
        items.filter((item) => item.status !== "draft" && !isStartupCampaign(item))
          .map((item) => api.getCampaign(item.id))
      ))
      .then((items) => {
        if (active) {
          setCampaigns(items);
          setError("");
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Campaigns are unavailable.");
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [retry]);

  const visibleCampaigns = useMemo(() => {
    const search = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (status === "active" && campaign.status !== "active") return false;
      if (status === "funded" && totalFunded(campaign) < campaign.goal_amount) return false;
      if (!search) return true;
      return [campaign.title, campaign.description, campaign.organizer_name]
        .some((value) => value?.toLowerCase().includes(search));
    });
  }, [campaigns, query, status]);

  return (
    <div className="pb-16">
      <header className="mb-8 max-w-2xl">
        <h1 className="display-heading text-4xl text-[#001435] dark:text-white sm:text-5xl">Public causes</h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Find a project to support. Open a campaign to see its budget and spending history.
        </p>
      </header>

      <div className="mb-7 flex flex-col gap-3 sm:flex-row" role="search">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search campaigns"
          aria-label="Search campaigns"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#001435] focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter campaigns by status"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#001435] focus:border-[#0070BA] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">All campaigns</option>
          <option value="active">Accepting donations</option>
          <option value="funded">Fully funded</option>
        </select>
      </div>

      {loading && <p role="status" className="py-12 text-center text-sm text-slate-600">Loading campaigns…</p>}
      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          <p>Could not load campaigns. {error}</p>
          <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }} className="mt-3 font-bold underline">Try again</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <h2 className="sr-only">Campaigns</h2>
          {visibleCampaigns.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-600 dark:text-slate-300">No campaigns match your search.</p>
              {(query || status !== "all") && <button type="button" onClick={() => { setQuery(""); setStatus("all"); }} className="mt-3 text-sm font-bold text-[#003087] dark:text-sky-300">Clear filters</button>}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visibleCampaigns.map((campaign) => {
                const funded = totalFunded(campaign);
                const image = campaignImagery(campaign.title);
                return (
                  <article key={campaign.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                    <Link href={`/campaigns/${campaign.id}`} className="relative block h-44 overflow-hidden bg-slate-100" aria-label={`View ${campaign.title}`}>
                      <Image src={image.src} alt={image.alt} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition group-hover:scale-105" />
                    </Link>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3"><StatusBadge status={campaign.status} /></div>
                      <h3 className="text-lg font-bold leading-snug text-[#001435] dark:text-white">
                        <Link href={`/campaigns/${campaign.id}`} className="hover:text-[#0070BA]">{campaign.title}</Link>
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{campaign.description}</p>
                      <div className="mt-auto pt-5">
                        <ProgressBar current={funded} goal={campaign.goal_amount} />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <strong className="text-[#001435] dark:text-white">{money(funded, campaign.currency)}</strong> raised of {money(campaign.goal_amount, campaign.currency)}
                        </p>
                        <Link href={`/campaigns/${campaign.id}`} className="mt-5 inline-block text-sm font-bold text-[#003087] hover:text-[#0070BA] dark:text-sky-300">View campaign &rarr;</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
