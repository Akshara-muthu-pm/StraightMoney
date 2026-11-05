"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import { money, totalFunded } from "@/lib/presentation";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import ProjectUpdates from "./ProjectUpdates";
import { campaignImagery } from "@/lib/campaign-imagery";
import { useDemoSession, followCampaign } from "@/lib/demo-session";

interface CampaignExploreProps {
  initialCategory?: "all" | "causes" | "education" | "startups";
  showHeader?: boolean;
}

export default function CampaignExplore({
  initialCategory = "all",
  showHeader = true,
}: CampaignExploreProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "causes" | "education" | "startups">(initialCategory);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "funded">("all");
  const [sortBy, setSortBy] = useState<"featured" | "progress" | "goal-desc" | "goal-asc">("featured");

  // Startup waitlist simulation state
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubscribed, setWaitlistSubscribed] = useState(false);

  const session = useDemoSession();
  const followedIds = session?.followed ?? [];

  useEffect(() => {
    let active = true;
    api
      .listCampaigns()
      .then((items) =>
        Promise.all(
          items
            .filter((item) => item.status !== "draft")
            .map((item) => api.getCampaign(item.id))
        )
      )
      .then((items) => {
        if (active) {
          setCampaigns(
            items.sort(
              (a, b) =>
                Number(b.title.toLowerCase().includes("library")) -
                Number(a.title.toLowerCase().includes("library"))
            )
          );
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Could not load campaigns."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retry]);

  // Handle category prop change if parent route changes
  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const totalGoal = campaigns.reduce((acc, c) => acc + c.goal_amount, 0);
    const totalRaised = campaigns.reduce((acc, c) => acc + totalFunded(c), 0);
    const totalLines = campaigns.reduce((acc, c) => acc + (c.budget_lines?.length || 0), 0);
    return { totalGoal, totalRaised, totalLines, count: campaigns.length };
  }, [campaigns]);

  // Filter & sort campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((campaign) => {
        // Category filtering
        if (activeCategory === "education") {
          const isEdu = /library|school|book|education|study|reading/i.test(
            `${campaign.title} ${campaign.description}`
          );
          if (!isEdu) return false;
        } else if (activeCategory === "causes") {
          // All active causes
          if (campaign.title.toLowerCase().includes("startup")) return false;
        }

        // Status filtering
        if (statusFilter === "active" && campaign.status !== "active") return false;
        if (statusFilter === "funded") {
          const funded = totalFunded(campaign);
          if (funded < campaign.goal_amount) return false;
        }

        // Text search filtering
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchTitle = campaign.title.toLowerCase().includes(query);
          const matchDesc = (campaign.description ?? "").toLowerCase().includes(query);
          const matchOrg = campaign.organizer_name.toLowerCase().includes(query);
          const matchLines = campaign.budget_lines?.some((line) =>
            line.name.toLowerCase().includes(query) ||
            (line.vendor_name ?? "").toLowerCase().includes(query)
          );
          if (!matchTitle && !matchDesc && !matchOrg && !matchLines) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "featured") {
          return (
            Number(b.title.toLowerCase().includes("library")) -
            Number(a.title.toLowerCase().includes("library"))
          );
        }
        if (sortBy === "progress") {
          const pctA = a.goal_amount > 0 ? totalFunded(a) / a.goal_amount : 0;
          const pctB = b.goal_amount > 0 ? totalFunded(b) / b.goal_amount : 0;
          return pctB - pctA;
        }
        if (sortBy === "goal-desc") return b.goal_amount - a.goal_amount;
        if (sortBy === "goal-asc") return a.goal_amount - b.goal_amount;
        return 0;
      });
  }, [campaigns, activeCategory, statusFilter, searchQuery, sortBy]);

  const featuredCampaign = campaigns[0];

  const handleFollow = (campaignId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    followCampaign(campaignId);
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (waitlistEmail.trim()) {
      setWaitlistSubscribed(true);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Header Section */}
      {showHeader && (
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-gradient-to-b from-white/90 via-white/80 to-[#F0F7FD]/80 p-6 shadow-xl shadow-blue-950/5 backdrop-blur-xl dark:border-slate-800 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-950/80 sm:p-12">
          {/* Subtle background ambient blob */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-to-br from-[#009CDE]/20 via-[#0070BA]/15 to-transparent blur-3xl dark:from-[#009CDE]/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-[#FFC439]/20 via-[#003087]/10 to-transparent blur-3xl dark:from-[#FFC439]/5"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200/90 bg-white/90 px-4 py-1.5 text-xs font-black tracking-wider text-[#003087] shadow-sm backdrop-blur-md dark:border-blue-900/80 dark:bg-slate-800/90 dark:text-blue-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0070BA] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0070BA]" />
              </span>
              TRANSPARENT COMMUNITY FUNDRAISING &middot; {USE_MOCKS ? "DEMO MODE" : "SANDBOX VERIFIED"}
            </div>

            <h1 className="display-heading mt-6 text-4xl sm:text-5xl lg:text-6xl text-[#001435] dark:text-white">
              Explore transparent causes.
            </h1>

            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              Support community projects where organizers never hold the money. Every dollar is earmarked for verified vendor budget lines and disbursed via PayPal only after invoice &amp; evidence approval.
            </p>

            {/* Quick Stats Ribbon */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Goal
                </span>
                <span className="mt-1 block text-lg font-black text-[#001435] dark:text-white">
                  {money(metrics.totalGoal || 1200)}
                </span>
                <span className="mt-0.5 block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  100% budget tracked
                </span>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Funded
                </span>
                <span className="mt-1 block text-lg font-black text-[#0070BA] dark:text-[#38bdf8]">
                  {money(metrics.totalRaised || 1200)}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  In pool &amp; paid payouts
                </span>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Vendor Lines
                </span>
                <span className="mt-1 block text-lg font-black text-[#001435] dark:text-white">
                  {metrics.totalLines || 3} line items
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Direct vendor payouts
                </span>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/60 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-800/60">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Protection
                </span>
                <span className="mt-1 block text-lg font-black text-emerald-700 dark:text-emerald-400">
                  8 Hard Rules
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Gemini OCR + Verifier
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Category Tabs & Search Bar */}
      <section className="space-y-4" aria-label="Search and filter campaigns">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Campaign Categories">
            {[
              { id: "all", label: "All Causes", count: campaigns.length },
              { id: "education", label: "Education & Schools", count: campaigns.filter((c) => /library|school|book|education/i.test(`${c.title} ${c.description}`)).length },
              { id: "causes", label: "Community & Civic", count: campaigns.length },
              { id: "startups", label: "Startups & Emerging", count: null },
            ].map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(tab.id as typeof activeCategory)}
                  className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070BA] ${
                    isActive
                      ? "bg-[#003087] text-white shadow-md shadow-[#003087]/20 dark:bg-[#0070BA]"
                      : "border border-slate-200/80 bg-white/80 text-slate-700 hover:border-blue-200 hover:bg-white hover:text-[#003087] dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.id === "startups" && (
                    <span className="rounded-full bg-[#FFC439] px-1.5 py-0.2 text-[9px] font-black uppercase text-[#001435]">
                      Beta
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort & Status controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by campaign status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 focus:border-[#0070BA] focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="funded">Fully Funded</option>
            </select>

            <select
              aria-label="Sort campaigns"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 focus:border-[#0070BA] focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="featured">Featured First</option>
              <option value="progress">Highest Progress</option>
              <option value="goal-desc">Goal: High to Low</option>
              <option value="goal-asc">Goal: Low to High</option>
            </select>
          </div>
        </div>

        {/* Live Search Input */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns by title, organizer, budget lines (e.g. shelves, books), or vendor..."
            className="w-full rounded-2xl border border-slate-200/90 bg-white/90 py-3.5 pl-11 pr-10 text-sm font-medium text-[#001435] placeholder:text-slate-400 shadow-sm transition focus:border-[#0070BA] focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900/90 dark:text-white dark:focus:ring-blue-950"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Loading & Error States */}
      {loading && (
        <div role="status" className="surface-card flex flex-col items-center justify-center p-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-[#003087]" />
          <p className="mt-4 text-sm font-bold text-[#001435] dark:text-white">
            Loading transparent community campaigns...
          </p>
          <p className="text-xs text-slate-500">Connecting to PayPal Sandbox &amp; PostgreSQL ledger...</p>
        </div>
      )}

      {error && (
        <div role="alert" className="surface-card border-rose-200 bg-rose-50/50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/20">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <h3 className="mt-3 text-lg font-bold text-rose-900 dark:text-rose-200">Could not load campaigns</h3>
          <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            className="button-primary mt-4 bg-rose-700 text-xs hover:bg-rose-800"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((v) => v + 1);
            }}
          >
            Retry connection
          </button>
        </div>
      )}

      {/* Startups & Innovation Special View */}
      {activeCategory === "startups" && (
        <section className="space-y-6" aria-labelledby="startups-banner-title">
          <div className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-gradient-to-br from-[#001435] via-[#00245E] to-[#00457C] p-8 text-white shadow-2xl sm:p-12">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-black tracking-wider text-[#BAE0FC] backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#FFC439]" />
                  STARTUP MILESTONE ESCROW &middot; COMING SOON
                </div>
                <h2 id="startups-banner-title" className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                  Fund emerging ventures without blind trust.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-blue-100">
                  StraightMoney for Startups brings invoice-governed capital to early-stage builders. Backers fund milestone pools, and funds are paid directly to prototyping labs, cloud providers, and manufacturers only when verified deliverables pass human and policy checks.
                </p>

                {/* Waitlist Form */}
                <div className="mt-8 max-w-md">
                  {waitlistSubscribed ? (
                    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/60 p-4 text-emerald-200 backdrop-blur-md">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        You&apos;re on the early-access list!
                      </p>
                      <p className="mt-1 text-xs text-emerald-200/90">
                        We&apos;ll notify you when the first startup milestone escrow campaign opens on StraightMoney.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="flex flex-col gap-2.5 sm:flex-row">
                      <input
                        type="email"
                        required
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        placeholder="Enter your email for early access..."
                        className="flex-1 rounded-full border border-white/30 bg-white/15 px-4 py-3 text-xs text-white placeholder:text-blue-200 focus:border-[#FFC439] focus:bg-white/20 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="button-gold rounded-full px-5 py-3 text-xs font-black whitespace-nowrap shadow-md shadow-[#FFC439]/30"
                      >
                        Notify Me &rarr;
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Startup Milestone Concept Diagram */}
              <div className="space-y-3 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#BAE0FC]">
                  How Startup Milestone Funding Works
                </p>
                {[
                  {
                    step: "01",
                    title: "Backers Pledge via PayPal Orders",
                    desc: "Funds pool safely in escrow balance; founder does not receive lump sum.",
                  },
                  {
                    step: "02",
                    title: "Supplier & Lab Deliverables",
                    desc: "Hardware labs and suppliers submit invoices and photo proof of working prototypes.",
                  },
                  {
                    step: "03",
                    title: "Gemini OCR & Advisor Validation",
                    desc: "Checks parts list, unit prices, and proof consistency automatically.",
                  },
                  {
                    step: "04",
                    title: "Direct Supplier PayPal Payout",
                    desc: "Approved amounts pay directly to the supplier's PayPal account.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3.5 transition hover:bg-white/10">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#009CDE] text-xs font-black text-white">
                      {item.step}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-white">{item.title}</h3>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-blue-100/80">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Campaign Discovery Content */}
      {!loading && !error && (
        <>
          {/* Featured Spotlight Campaign (Only show when not filtering by non-matching query) */}
          {featuredCampaign && !searchQuery && activeCategory !== "startups" && (
            <section aria-labelledby="featured-campaign-title" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-[#38bdf8]">
                  Flagship Spotlight Campaign
                </p>
                <span className="rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-bold text-brand-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  {USE_MOCKS ? "Sample Prototype" : "Live Sandbox"}
                </span>
              </div>

              <article className="surface-card relative grid items-stretch overflow-hidden rounded-[2.5rem] border border-white/90 shadow-2xl shadow-blue-950/10 lg:grid-cols-[1.1fr_1.3fr] dark:border-slate-800">
                {/* Hero Photo Column */}
                <div className="relative min-h-[340px] w-full bg-slate-100 lg:min-h-[460px]">
                  <Image
                    src={campaignImagery(featuredCampaign.title).src}
                    alt={campaignImagery(featuredCampaign.title).alt}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/70 via-transparent to-transparent lg:hidden" />
                  
                  {/* Floating Top Badges */}
                  <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/60 bg-white/95 px-3 py-1 text-[11px] font-black tracking-wide text-[#001435] shadow-md backdrop-blur-md">
                      FEATURED
                    </span>
                    <span className="rounded-full border border-white/60 bg-[#FFC439] px-3 py-1 text-[11px] font-black tracking-wide text-[#001435] shadow-md">
                      PAYPAL SANDBOX
                    </span>
                  </div>

                  <span className="photo-label">Illustrative photo / not campaign evidence</span>
                </div>

                {/* Details Column */}
                <div className="flex flex-col justify-between p-6 sm:p-10">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#003087] text-[11px] font-bold text-white">
                          {featuredCampaign.organizer_name.charAt(0)}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          Organized by <strong className="text-slate-900 dark:text-white">{featuredCampaign.organizer_name}</strong>
                        </span>
                      </div>
                      <StatusBadge status={featuredCampaign.status} />
                    </div>

                    <h2 id="featured-campaign-title" className="mt-4 text-3xl font-extrabold tracking-tight text-[#001435] dark:text-white sm:text-4xl">
                      {featuredCampaign.title}
                    </h2>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {featuredCampaign.description}
                    </p>

                    {/* Progress Bar & Amounts */}
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                      <ProgressBar
                        current={totalFunded(featuredCampaign)}
                        goal={featuredCampaign.goal_amount}
                        caption="Total Transparent Funding"
                      />
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          <strong className="text-base font-black text-[#001435] dark:text-white">
                            {money(totalFunded(featuredCampaign), featuredCampaign.currency)}
                          </strong>{" "}
                          funded of {money(featuredCampaign.goal_amount, featuredCampaign.currency)} goal
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          {Math.round((totalFunded(featuredCampaign) / featuredCampaign.goal_amount) * 100)}% Reached
                        </span>
                      </div>
                    </div>

                    {/* Transparent Budget Lines Matrix (Signature Feature) */}
                    <div className="mt-6 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold uppercase tracking-wider text-[#003087] dark:text-[#38bdf8]">
                          Earmarked Vendor Budget Lines
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {featuredCampaign.budget_lines.length} direct allocations
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {featuredCampaign.budget_lines.map((line) => (
                          <div
                            key={line.id}
                            className="rounded-xl border border-slate-200/80 bg-white/90 p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-800/70"
                          >
                            <div className="flex items-center justify-between">
                              <strong className="text-xs font-bold text-[#001435] dark:text-white">{line.name}</strong>
                              <span className="text-xs font-black text-[#0070BA] dark:text-[#38bdf8]">
                                {money(line.budgeted_amount, featuredCampaign.currency)}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              Vendor: <span className="font-semibold text-slate-700 dark:text-slate-300">{line.vendor_name ?? "Assigned Vendor"}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/90 pt-5 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/campaigns/${featuredCampaign.id}#donate`}
                        className="button-gold rounded-full px-5 py-2.5 text-xs font-black shadow-md shadow-[#FFC439]/30 transition hover:scale-105"
                      >
                        Donate via PayPal &rarr;
                      </Link>
                      <Link
                        href={`/campaigns/${featuredCampaign.id}`}
                        className="button-secondary rounded-full px-4 py-2.5 text-xs font-bold"
                      >
                        Campaign Details
                      </Link>
                      <Link
                        href={`/ledger/${featuredCampaign.id}`}
                        className="inline-flex items-center gap-1.5 p-2 text-xs font-bold text-[#003087] underline hover:text-[#0070BA] dark:text-blue-400"
                      >
                        Public Ledger &rarr;
                      </Link>
                    </div>

                    {session && (
                      <button
                        type="button"
                        onClick={(e) => handleFollow(featuredCampaign.id, e)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                          followedIds.includes(featuredCampaign.id)
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                        }`}
                        title="Follow updates for this campaign"
                      >
                        <span>{followedIds.includes(featuredCampaign.id) ? "♥ Following" : "♡ Follow"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            </section>
          )}

          {/* All Filtered Campaigns Grid */}
          <section aria-labelledby="all-campaigns-heading" className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Discover Local &amp; Transparent Initiatives</p>
                <h2 id="all-campaigns-heading" className="display-heading mt-2 text-3xl sm:text-4xl">
                  {searchQuery ? `Search Results for "${searchQuery}"` : "Published Campaigns"}
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Showing {filteredCampaigns.length} {filteredCampaigns.length === 1 ? "campaign" : "campaigns"}
              </span>
            </div>

            {/* Empty State */}
            {filteredCampaigns.length === 0 && (
              <div className="surface-card flex flex-col items-center justify-center p-12 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <h3 className="mt-4 text-xl font-bold text-[#001435] dark:text-white">
                  No matching campaigns found
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
                  We couldn&apos;t find any campaigns matching your search or filters. Try adjusting your query or resetting filters.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("all");
                      setStatusFilter("all");
                    }}
                    className="button-primary text-xs"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            )}

            {/* Cards Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => {
                const funded = totalFunded(campaign);
                const percent = Math.min(100, Math.round((funded / campaign.goal_amount) * 100));
                const isFollowed = followedIds.includes(campaign.id);

                return (
                  <article
                    key={campaign.id}
                    className="surface-card group flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/80 transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800"
                  >
                    <div>
                      {/* Image Header with Badges */}
                      <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                        <Image
                          src={campaignImagery(campaign.title).src}
                          alt={campaignImagery(campaign.title).alt}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/60 via-transparent to-transparent" />
                        
                        <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5">
                          <StatusBadge status={campaign.status} />
                        </div>

                        {session && (
                          <button
                            type="button"
                            onClick={(e) => handleFollow(campaign.id, e)}
                            className={`absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md shadow-sm transition ${
                              isFollowed
                                ? "bg-rose-500 text-white"
                                : "bg-white/80 text-slate-700 hover:bg-white"
                            }`}
                            aria-label={isFollowed ? "Unfollow campaign" : "Follow campaign"}
                          >
                            ♥
                          </button>
                        )}

                        <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-200">
                            Organized by {campaign.organizer_name}
                          </p>
                        </div>
                      </div>

                      {/* Content Body */}
                      <div className="p-6">
                        <h3 className="text-xl font-extrabold text-[#001435] transition group-hover:text-[#0070BA] dark:text-white dark:group-hover:text-[#38bdf8]">
                          <Link href={`/campaigns/${campaign.id}`}>
                            {campaign.title}
                          </Link>
                        </h3>

                        <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2 dark:text-slate-300">
                          {campaign.description}
                        </p>

                        {/* Progress Bar */}
                        <div className="mt-5 space-y-1.5">
                          <ProgressBar current={funded} goal={campaign.goal_amount} />
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>
                              <strong className="font-extrabold text-[#001435] dark:text-white">
                                {money(funded, campaign.currency)}
                              </strong>{" "}
                              funded
                            </span>
                            <span className="font-bold text-slate-500">
                              {percent}% of {money(campaign.goal_amount, campaign.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Budget Lines Preview Chips */}
                        <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Transparent Budget Breakdown:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {campaign.budget_lines.map((line) => (
                              <span
                                key={line.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-50/80 px-2 py-0.5 text-[10px] font-bold text-[#003087] dark:bg-slate-800 dark:text-blue-300"
                              >
                                <span>{line.name}:</span>
                                <span>{money(line.budgeted_amount, campaign.currency)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 p-5 pt-4 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/campaigns/${campaign.id}#donate`}
                          className="button-gold rounded-full px-3.5 py-1.5 text-xs font-black shadow-sm"
                        >
                          Donate
                        </Link>
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="button-secondary rounded-full px-3 py-1.5 text-xs font-bold"
                        >
                          Story
                        </Link>
                      </div>

                      <Link
                        href={`/ledger/${campaign.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003087] underline hover:text-[#0070BA] dark:text-blue-400"
                      >
                        Public Ledger &rarr;
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* How StraightMoney Protects Funds Diagram */}
          <section className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/70 p-8 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60 sm:p-12">
            <div className="text-center max-w-2xl mx-auto">
              <p className="eyebrow">The Zero-Theft Architecture</p>
              <h2 className="display-heading mt-2 text-3xl sm:text-4xl text-[#001435] dark:text-white">
                How every dollar stays accounted for.
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Unlike traditional crowdfunding platforms where organizers withdraw lump-sum cash, StraightMoney locks every contribution until verified.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "Step 1",
                  title: "Donation via PayPal",
                  desc: "Donors contribute through PayPal Orders v2. Captured funds enter the campaign balance and are locked for budget line items.",
                  icon: "💳",
                },
                {
                  step: "Step 2",
                  title: "Vendor Submits Invoice",
                  desc: "Vendors perform the work and upload an itemized invoice plus delivery photo proof directly to the portal.",
                  icon: "📄",
                },
                {
                  step: "Step 3",
                  title: "Gemini AI & 8 Python Rules",
                  desc: "Gemini OCR extracts invoice fields. Pure-code rules verify vendor email, line budget cap, duplicates, and proof validity.",
                  icon: "🛡️",
                },
                {
                  step: "Step 4",
                  title: "Direct Vendor Payout",
                  desc: "A human verifier signs off. PayPal Payouts sends money directly to the vendor's PayPal account. Public ledger updates instantly.",
                  icon: "✅",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-slate-100 bg-white/80 p-5 shadow-xs dark:border-slate-800 dark:bg-slate-800/80"
                >
                  <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                  <span className="mt-3 block text-[10px] font-extrabold uppercase tracking-widest text-[#0070BA] dark:text-[#38bdf8]">
                    {item.step}
                  </span>
                  <h3 className="mt-1 text-sm font-bold text-[#001435] dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Project Updates Component for the Featured Campaign */}
          {featuredCampaign && (
            <div className="pt-4">
              <ProjectUpdates key={featuredCampaign.id} campaignId={featuredCampaign.id} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
