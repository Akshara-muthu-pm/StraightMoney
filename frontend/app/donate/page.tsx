"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import PayPalDonateButton from "@/components/PayPalDonateButton";
import ProgressBar from "@/components/ProgressBar";
import StatusBadge from "@/components/StatusBadge";
import { campaignImagery } from "@/lib/campaign-imagery";
import { api } from "@/lib/api";
import { money, totalFunded } from "@/lib/presentation";
import type { Campaign } from "@/lib/types";

export default function DonatePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    let active = true;
    api
      .listCampaigns()
      .then((items) => Promise.all(items.filter((item) => item.status === "active").map((item) => api.getCampaign(item.id))))
      .then((items) => { if (active) setCampaigns(items); })
      .catch(() => {
        if (active) setError("We couldn’t load campaigns right now. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const campaign = campaigns.find((item) => item.id === selectedId) ?? campaigns[0];

  const refresh = async () => {
    if (!campaign) return;
    const updated = await api.getCampaign(campaign.id);
    setCampaigns((items) => items.map((item) => (item.id === updated.id ? updated : item)));
  };

  const imagery = campaign ? campaignImagery(campaign.title, "detail") : null;

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12">
      {/* Top Breadcrumb & Trust Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
        <Link
          href="/#campaigns"
          className="inline-flex items-center gap-2 rounded-full border-2 border-slate-200/90 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 shadow-2xs backdrop-blur-md transition hover:border-[#0070BA] hover:text-[#003087] hover:shadow-xs dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          &larr; Browse all campaigns
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3.5 py-1 text-[11px] font-black tracking-wider text-[#003087] shadow-2xs backdrop-blur-md dark:border-blue-500/30 dark:from-blue-950/80 dark:to-indigo-950/80 dark:text-sky-300">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
          PAYPAL ORDERS V2 &middot; SANDBOX CHECKOUT
        </div>
      </div>

      {/* Hero Header & Graphic Artwork */}
      <div className="relative mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
              Direct Community Impact
            </p>
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#001435] dark:text-white sm:text-5xl">
            Make a <span className="bg-gradient-to-r from-[#003087] via-[#0070BA] to-[#009CDE] bg-clip-text text-transparent">verified contribution</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Choose the community project you want to back. Organizers never hold your donation: funds are captured directly into the campaign balance and released via PayPal Payouts to verified vendors after a human verifier reviews delivery evidence.
          </p>

          {/* Graphical Fintech Trust Pillars */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-[#0070BA]/50 hover:shadow-xs dark:border-white/10 dark:bg-slate-900/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] to-[#0070BA] text-white shadow-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <div>
                <strong className="block text-xs font-black text-[#001435] dark:text-white">Campaign Balance</strong>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">PayPal Orders v2</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-[#0070BA]/50 hover:shadow-xs dark:border-white/10 dark:bg-slate-900/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0070BA] to-[#009CDE] text-white shadow-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 12 2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </span>
              <div>
                <strong className="block text-xs font-black text-[#001435] dark:text-white">Gemini AI Audit</strong>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Invoice &amp; Proof Check</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-200/80 bg-white p-3.5 shadow-2xs transition hover:border-[#0070BA]/50 hover:shadow-xs dark:border-white/10 dark:bg-slate-900/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <strong className="block text-xs font-black text-[#001435] dark:text-white">Direct Payouts</strong>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Straight to Vendor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Graphical Mini-Artwork Card */}
        <div className="relative hidden rounded-3xl border-2 border-slate-200/80 bg-white p-4 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80 lg:block">
          <div className="relative h-44 w-full overflow-hidden rounded-2xl">
            <Image
              src="/images/impact-giving.jpg"
              alt="Community hands holding a shared growing plant"
              fill
              sizes="(max-width: 1200px) 35vw, 400px"
              className="object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/80 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Transparency
              </span>
              <span className="text-[11px] font-black tracking-wide text-amber-300">Tracked payouts</span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
            Join other community members funding local change with a public record of campaign spending.
          </p>
        </div>
      </div>

      {loading && (
        <div role="status" className="liquid-glass mt-8 p-8 text-center text-sm font-semibold text-slate-600 dark:text-slate-300">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#0070BA] border-t-transparent mb-3" />
          Loading active campaigns accepting contributions...
        </div>
      )}

      {error && (
        <div role="alert" className="liquid-glass mt-8 border-red-200/80 p-6 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          <p>{error}</p>
          <button
            type="button"
            className="button-secondary mt-4 text-xs"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !campaign && (
        <div className="liquid-glass mt-8 p-8 text-center dark:text-slate-300">
          <p className="text-slate-600 dark:text-slate-300">No campaigns are currently accepting contributions.</p>
          <Link href="/#campaigns" className="button-primary mt-4 text-xs">
            Explore campaigns
          </Link>
        </div>
      )}

      {!loading && !error && campaign && (
        <>
          {/* Graphical Interactive Campaign Selector Cards */}
          {campaigns.length > 1 && (
            <section className="mt-10" aria-label="Available Campaigns">
              <div className="flex items-center justify-between gap-4 mb-3.5">
                <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select a project to support ({campaigns.length} active)
                </p>
              </div>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((item) => {
                  const isSelected = item.id === campaign.id;
                  const itemImage = campaignImagery(item.title, "card");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`group relative flex items-center gap-3.5 rounded-2xl p-3 text-left transition-all duration-200 ${
                        isSelected
                          ? "border-2 border-[#0070BA] bg-white shadow-md shadow-blue-900/10 ring-4 ring-[#0070BA]/15 dark:border-[#009CDE] dark:bg-slate-900/95 dark:ring-[#009CDE]/20"
                          : "border-2 border-slate-200/90 bg-white/90 text-slate-800 shadow-2xs hover:border-[#0070BA]/60 hover:bg-white hover:shadow-xs dark:border-white/10 dark:bg-slate-900/60"
                      }`}
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                        <Image
                          src={itemImage.src}
                          alt={itemImage.alt}
                          fill
                          sizes="64px"
                          className="object-cover transition duration-300 group-hover:scale-110"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-black text-[#001435] dark:text-white group-hover:text-[#0070BA] dark:group-hover:text-sky-300">
                            {item.title}
                          </span>
                          {isSelected && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0070BA] text-white">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Goal: {money(item.goal_amount, item.currency)}
                        </span>
                        <span className="mt-1 block text-[10px] font-bold text-[#0070BA] dark:text-sky-400">
                          {money(item.pool_balance, item.currency)} available
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Main 2-Column Donation Interface */}
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left Column: Donation Form & PayPal Checkout */}
            <section className="liquid-glass p-6 sm:p-8" aria-labelledby="donation-form-title">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 pb-4 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0070BA] text-white shadow-xs">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                    </svg>
                  </span>
                  <div>
                    <h2 id="donation-form-title" className="text-xl font-extrabold tracking-tight text-[#001435] dark:text-white">
                      Contribution Checkout
                    </h2>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Destination: <strong className="text-[#0070BA] dark:text-sky-300">{campaign.title}</strong>
                    </p>
                  </div>
                </div>
                <StatusBadge status={campaign.status} />
              </div>

              {/* Accessible Dropdown Selector */}
              <label className="mt-5 mb-5 block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Select Target Campaign
                <select
                  value={campaign.id}
                  onChange={(event) => setSelectedId(Number(event.target.value))}
                  className="mt-2 w-full rounded-2xl border-2 border-slate-200/90 bg-white px-4 py-3 text-sm font-bold text-[#001435] shadow-2xs transition hover:border-slate-300 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-white/15 dark:bg-slate-900/90 dark:text-white"
                >
                  {campaigns.map((item) => (
                    <option key={item.id} value={item.id} className="bg-white text-slate-900 dark:bg-[#001435] dark:text-white">
                      {item.title} &mdash; {money(item.goal_amount, item.currency)} goal
                    </option>
                  ))}
                </select>
              </label>

              <PayPalDonateButton
                key={campaign.id}
                campaignId={campaign.id}
                campaignTitle={campaign.title}
                currency={campaign.currency}
                progressHref={`/campaigns/${campaign.id}#updates`}
                onCaptured={refresh}
              />
            </section>

            {/* Right Column: Visual Selected Project Showcase */}
            <aside className="liquid-glass flex flex-col justify-between overflow-hidden p-0 sm:p-0" aria-labelledby="selected-project-title">
              {/* Visual Hero Image Container */}
              <div className="relative min-h-[220px] w-full bg-slate-100 sm:min-h-[260px] dark:bg-slate-950">
                {imagery && (
                  <Image
                    src={imagery.src}
                    alt={imagery.alt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/90 via-[#001435]/25 to-transparent" />
                
                {/* Photo Badges */}
                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                  <StatusBadge status={campaign.status} />
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-[#001435]/80 px-3 py-1 text-[11px] font-extrabold text-white shadow-xs backdrop-blur-md">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    </svg>
                    PayPal Sandbox Checkout
                  </span>
                </div>

                <div className="absolute bottom-3 left-4 right-4">
                  <span className="photo-label">Illustrative project visual</span>
                </div>
              </div>

              {/* Campaign Body Details */}
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#009CDE] animate-pulse" />
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
                    Selected Community Project
                  </p>
                </div>

                <h2 id="selected-project-title" className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435] dark:text-white sm:text-3xl">
                  {campaign.title}
                </h2>

                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Organized by <strong className="text-slate-800 dark:text-slate-200">{campaign.organizer_name}</strong>
                </p>

                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {campaign.description}
                </p>

                {/* Dynamic Animated Funding Progress Bar */}
                <div className="mt-6 rounded-2xl border-2 border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-900/60">
                  <ProgressBar
                    current={totalFunded(campaign)}
                    goal={campaign.goal_amount}
                    caption="Campaign funding"
                  />
                </div>

                {/* Metric Breakdown Cards */}
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border-2 border-slate-200/80 bg-slate-50/90 p-4 shadow-2xs dark:border-white/10 dark:bg-slate-900/60">
                    <dt className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Campaign Target
                    </dt>
                    <dd className="mt-1 text-xl font-black text-[#001435] dark:text-white">
                      {money(campaign.goal_amount, campaign.currency)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border-2 border-blue-200/90 bg-blue-50/90 p-4 shadow-2xs dark:border-blue-500/30 dark:bg-blue-950/50">
                    <dt className="text-[11px] font-extrabold uppercase tracking-wider text-[#003087] dark:text-sky-300 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
                      Available funds
                    </dt>
                    <dd className="mt-1 text-xl font-black text-[#003087] dark:text-sky-200">
                      {money(campaign.pool_balance, campaign.currency)}
                    </dd>
                  </div>
                </dl>

                {/* Trust Guarantees */}
                <div className="mt-6 space-y-2 rounded-2xl border-2 border-emerald-200/90 bg-emerald-50/80 p-4 text-xs dark:border-emerald-500/20 dark:bg-emerald-950/20">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
                      ✓
                    </span>
                    <p className="text-emerald-950 dark:text-emerald-200 font-semibold leading-relaxed">
                      <strong>Vendor payout routing:</strong> Organizers never touch donation money. Funds are disbursed strictly via PayPal Payouts to verified vendors upon approved invoices.
                    </p>
                  </div>
                </div>

                {/* Action Links */}
                <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-[#003087] dark:text-sky-400">
                  <Link href={`/campaigns/${campaign.id}#campaign-story`} className="underline hover:text-[#0070BA] dark:hover:text-sky-300">
                    Read full project story &rarr;
                  </Link>
                  <Link href={`/ledger/${campaign.id}`} className="underline hover:text-[#0070BA] dark:hover:text-sky-300">
                    View public spending ledger &rarr;
                  </Link>
                </div>

                <p className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-400">
                  A human verifier reviews vendor invoices, itemization, and delivery proof photos before approving disbursements.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
