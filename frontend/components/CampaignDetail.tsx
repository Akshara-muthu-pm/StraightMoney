"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign, Invoice, LedgerEntry } from "@/lib/types";
import { money, totalFunded } from "@/lib/presentation";
import { budgetSummary } from "@/lib/budget";
import { campaignImagery } from "@/lib/campaign-imagery";
import { useDemoSession, followCampaign } from "@/lib/demo-session";
import PayPalDonateButton from "@/components/PayPalDonateButton";
import ProgressBar from "@/components/ProgressBar";
import StatusBadge from "@/components/StatusBadge";
import ProjectUpdates from "@/components/ProjectUpdates";

// Interactive Gallery Images for the Flagship Campaign
const galleryImages = [
  {
    src: "/images/library.jpg",
    alt: "Inviting school library corner with freshly installed shelves and books",
    title: "Library Corner",
    caption: "The planned reading sanctuary for elementary students",
  },
  {
    src: "/images/campaign-books.jpg",
    alt: "Colorful stacks of educational and storytelling books",
    title: "Curated Books",
    caption: "Over 120 grade-level books planned across fiction & science",
  },
  {
    src: "/images/community-volunteers.jpg",
    alt: "Community volunteers moving and assembling storage boxes",
    title: "Community Team",
    caption: "Local parents and volunteer helpers preparing the room",
  },
  {
    src: "/images/hero-planning.jpg",
    alt: "Architectural and budget blueprint planning",
    title: "Project Blueprints",
    caption: "Exact measurements and line-item allocations before purchase",
  },
];

// Interactive Impact Calculator Tiers
const impactTiers = [
  { amount: 25, title: "Book Supporter", detail: "Funds 3 new fiction or science books", icon: "📚", line: "Books" },
  { amount: 50, title: "Classroom Pack", detail: "Supplies a full curated subject reading pack", icon: "📖", line: "Books" },
  { amount: 100, title: "Shelf Material", detail: "Covers heavy-duty hardwood shelving brackets", icon: "🪵", line: "Shelves" },
  { amount: 200, title: "Fresh Paint Kit", detail: "Fully funds non-toxic primer & vibrant interior paint", icon: "🎨", line: "Paint" },
  { amount: 400, title: "Complete Shelving", detail: "Completely funds an entire 4-tier assembly", icon: "🏗️", line: "Shelves" },
];

export default function CampaignDetail({ id }: { id: number }) {
  const session = useDemoSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // UI Interactive States
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [calculatorAmount, setCalculatorAmount] = useState(50);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"story" | "budget" | "updates" | "ledger" | "faq">("story");
  const [budgetExpandedLine, setBudgetExpandedLine] = useState<number | null>(null);

  const followed = session?.followed.includes(id) ?? false;

  // Fetch campaign, invoices, and ledger data
  useEffect(() => {
    let active = true;
    Promise.all([api.getCampaign(id), api.getInvoices(id).catch(() => []), api.getLedger(id).catch(() => [])])
      .then(([camp, invs, ledger]) => {
        if (active) {
          setCampaign(camp);
          setInvoices(invs);
          setLedgerEntries(ledger);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load campaign details.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, retryKey]);

  // Refresh after payment capture
  const handlePaymentCaptured = async () => {
    const [updated, invs, ledger] = await Promise.all([
      api.getCampaign(id),
      api.getInvoices(id).catch(() => []),
      api.getLedger(id).catch(() => []),
    ]);
    setCampaign(updated);
    setInvoices(invs);
    setLedgerEntries(ledger);
  };

  // Calculate budget summaries
  const budgetRows = useMemo(() => {
    if (!campaign) return [];
    return campaign.budget_lines.map((line) => budgetSummary(line, invoices));
  }, [campaign, invoices]);

  const budgetTotals = useMemo(() => {
    return budgetRows.reduce(
      (acc, row) => ({
        planned: acc.planned + row.planned,
        paid: acc.paid + row.paid,
        approvedUnpaid: acc.approvedUnpaid + row.approvedUnpaid,
        remaining: acc.remaining + row.remaining,
      }),
      { planned: 0, paid: 0, approvedUnpaid: 0, remaining: 0 }
    );
  }, [budgetRows]);

  // Filter recent donations
  const recentDonations = useMemo(() => {
    return ledgerEntries
      .filter((entry) => entry.type === "donation" && entry.status === "captured")
      .slice(0, 5);
  }, [ledgerEntries]);

  const simulatedCount = useMemo(() => {
    return ledgerEntries.filter(
      (entry) => entry.type === "donation" && entry.source === "simulated" && entry.status === "captured"
    ).length;
  }, [ledgerEntries]);
  const donorCount = ledgerEntries.filter((entry) => entry.type === "donation" && entry.status === "captured" &&
    (entry.donation_id == null || entry.amount + ledgerEntries.filter((adjustment) => adjustment.donation_id === entry.donation_id && (adjustment.type === "refund" || adjustment.type === "dispute"))
      .reduce((sum, adjustment) => sum + adjustment.amount, 0) > 0)).length;

  // Copy campaign share link
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Scroll to donate section smoothly
  const scrollToDonate = () => {
    const donateElem = document.getElementById("donate-sidebar");
    if (donateElem) {
      donateElem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (loading) {
    return (
      <main id="main-content" tabIndex={-1} className="page-width py-16 text-center">
        <div className="surface-card mx-auto max-w-lg p-12">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-[#003087]" />
          <h2 className="mt-6 text-xl font-extrabold text-[#001435] dark:text-white">
            Loading Campaign Story...
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Synchronizing live PayPal balance, line-item budgets, and public ledger...
          </p>
        </div>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main id="main-content" tabIndex={-1} className="page-width py-16 text-center">
        <div className="surface-card mx-auto max-w-lg border-rose-200 bg-rose-50/50 p-10 dark:border-rose-900/50 dark:bg-rose-950/20">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <h2 className="mt-4 text-2xl font-bold text-rose-900 dark:text-rose-200">
            Campaign Unavailable
          </h2>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
            {error ?? "We could not find the requested campaign."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setLoading(true);
                setRetryKey((k) => k + 1);
              }}
              className="button-primary text-xs"
            >
              Try Again
            </button>
            <Link href="/explore/public-causes" className="button-secondary text-xs">
              Back to Public Causes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const fundedAmount = totalFunded(campaign);
  const percentFunded = campaign.goal_amount > 0 ? Math.min(100, Math.round((fundedAmount / campaign.goal_amount) * 100)) : 0;
  const currentImage = galleryImages[selectedImageIndex] ?? {
    src: campaignImagery(campaign.title, "detail").src,
    alt: campaignImagery(campaign.title, "detail").alt,
    title: campaign.title,
    caption: "Project illustration",
  };

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-8 sm:py-12 space-y-10">
      {/* 1. Breadcrumbs & Quick Social Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold">
          <Link
            href="/explore"
            className="text-slate-500 hover:text-[#003087] transition dark:text-slate-400 dark:hover:text-white"
          >
            Explore
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <Link
            href="/explore/public-causes"
            className="text-slate-500 hover:text-[#003087] transition dark:text-slate-400 dark:hover:text-white"
          >
            Public Causes
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-[#003087] font-extrabold dark:text-[#38bdf8] truncate max-w-[200px] sm:max-w-none">
            {campaign.title}
          </span>
        </nav>

        <div className="flex items-center gap-2">
          {/* Share / Copy Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-200 hover:text-[#003087] dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300"
            title="Share this campaign link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>{copiedLink ? "Link copied!" : "Share"}</span>
          </button>

          {/* Follow Project Button */}
          {session ? (
            <button
              type="button"
              onClick={() => followCampaign(campaign.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition shadow-xs ${
                followed
                  ? "bg-rose-500 text-white shadow-rose-500/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>{followed ? "♥ Following" : "♡ Follow"}</span>
            </button>
          ) : (
            <Link
              href="/signin"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-200 hover:text-[#003087] dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300"
            >
              <span>♡ Follow</span>
            </Link>
          )}

          <Link
            href={`/ledger/${campaign.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/90 px-3.5 py-1.5 text-xs font-extrabold text-[#003087] shadow-xs transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300"
          >
            <span>Ledger</span> &rarr;
          </Link>
        </div>
      </div>

      {/* 2. Campaign Header & Trust Guarantees */}
      <section className="space-y-4" aria-labelledby="campaign-header-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#003087] to-[#0070BA] text-xs font-extrabold text-white shadow-sm">
              {campaign.organizer_name.charAt(0)}
            </span>
            <div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Organized by <strong className="text-[#001435] dark:text-white">{campaign.organizer_name}</strong>
              </p>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Verified Community Organizer
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-[11px] font-black tracking-wide text-[#003087] dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
              PAYPAL SANDBOX
            </span>
            <StatusBadge status={campaign.status} />
          </div>
        </div>

        <h1
          id="campaign-header-title"
          className="display-heading text-4xl sm:text-5xl lg:text-6xl text-[#001435] dark:text-white tracking-tight"
        >
          {campaign.title}
        </h1>

        <p className="max-w-3xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {campaign.description}
        </p>

        {(campaign.cancelled_at || ledgerEntries.some((entry) => entry.type === "refund" || entry.type === "dispute")) && <div className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950" role="status">
          {campaign.cancelled_at && <p><strong>Campaign cancelled.</strong> {campaign.cancellation_reason} New donations have stopped. Captured payments are refunded individually through PayPal; completed payouts remain in the ledger.</p>}
          {ledgerEntries.filter((entry) => entry.type === "refund" || entry.type === "dispute").map((entry, index) => <p key={`${entry.created_at}-${index}`}>
            <strong>{entry.type === "refund" ? "Refund" : "Dispute"}:</strong> {entry.actor_name} · {entry.status.replaceAll("_", " ")} · {money(Math.abs(entry.amount), campaign.currency)} {entry.amount < 0 ? "removed from available funds" : "currently affecting no available funds"}.
          </p>)}
        </div>}

        {/* 4 Feature Badges Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-2">
          {[
            { label: "Zero Organizer Cash", desc: "Money never enters personal accounts", icon: "🛡️" },
            { label: "3 Verified Vendors", desc: "Shelves, Books & Paint line items", icon: "🏷️" },
            { label: "Gemini OCR Audited", desc: "AI checks invoices & photo evidence", icon: "🤖" },
            { label: "PayPal Payouts", desc: "Disbursed only upon verifier approval", icon: "💳" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/90 bg-white/70 p-3 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-800/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">{item.icon}</span>
                <strong className="text-xs font-bold text-[#001435] dark:text-white">{item.label}</strong>
              </div>
              <p className="mt-1 text-xs leading-tight text-slate-600 dark:text-slate-300 pl-6">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Main Stage: Two Columns (Interactive Gallery + Sticky Donation Deck) */}
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] items-start">
        {/* Left Stage: Gallery, Tabs, Interactive Modules */}
        <div className="space-y-10 min-w-0">
          {/* Interactive Multi-Photo Gallery */}
          <section aria-label="Campaign visual gallery" className="space-y-3">
            <div className="surface-card relative overflow-hidden rounded-[2.5rem] border border-white/90 shadow-xl shadow-blue-950/10 dark:border-slate-800">
              {/* Main Feature Image Display */}
              <div className="relative h-72 sm:h-96 md:h-[460px] w-full bg-slate-900">
                <Image
                  key={currentImage.src}
                  src={currentImage.src}
                  alt={currentImage.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover transition duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/80 via-transparent to-transparent" />

                {/* Floating Overlays */}
                <div className="absolute left-5 top-5 flex items-center gap-2">
                  <span className="rounded-full border border-white/40 bg-black/50 px-3.5 py-1 text-[11px] font-black text-white backdrop-blur-md">
                    {currentImage.title}
                  </span>
                </div>

                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <p className="text-sm font-extrabold sm:text-base">{currentImage.caption}</p>
                  <p className="text-[10px] text-blue-200/80">Illustrative project concept / not delivery evidence</p>
                </div>
              </div>
            </div>

            {/* Thumbnail Selectors */}
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3" role="tablist" aria-label="Gallery thumbnails">
              {galleryImages.map((img, index) => {
                const isSelected = selectedImageIndex === index;
                return (
                  <button
                    key={img.src}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`group relative h-16 sm:h-20 overflow-hidden rounded-2xl border-2 transition duration-200 focus-visible:outline-2 focus-visible:outline-[#0070BA] ${
                      isSelected
                        ? "border-[#0070BA] ring-2 ring-[#0070BA]/30 scale-[1.02]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Image src={img.src} alt={img.alt} fill sizes="120px" className="object-cover" />
                    <span className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                    <span className="absolute bottom-1 left-1.5 right-1.5 truncate text-[9px] font-black text-white drop-shadow-md">
                      {img.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Interactive In-Page Sticky Tab Navigation Bar */}
          <nav
            aria-label="Campaign sections navigation"
            className="sticky top-16 z-20 flex overflow-x-auto rounded-2xl border border-white/90 bg-white/90 p-1.5 shadow-md backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90"
          >
            {[
              { id: "story", label: "Story & Vision", icon: "📖" },
              { id: "budget", label: "Budget Matrix", icon: "📊" },
              { id: "calculator", label: "Impact Calculator", icon: "💡" },
              { id: "updates", label: "Live Evidence", icon: "🧾" },
              { id: "ledger", label: "Donors & Ledger", icon: "📜" },
              { id: "faq", label: "FAQ & Safety", icon: "❓" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as typeof activeTab);
                    const el = document.getElementById(`section-${tab.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? "bg-[#003087] text-white shadow-sm dark:bg-[#0070BA]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-[#001435] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* SECTION 1: Story & Mission Details */}
          <section id="section-story" className="space-y-6 scroll-mt-28" aria-labelledby="story-heading">
            <div className="surface-card rounded-[2.5rem] border border-white/90 p-7 sm:p-10 dark:border-slate-800">
              <p className="eyebrow">The Campaign Story</p>
              <h2 id="story-heading" className="display-heading mt-2 text-2xl sm:text-3xl text-[#001435] dark:text-white">
                Transforming the School Library Corner
              </h2>

              <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <p>
                  Every young reader deserves a dedicated, quiet, and welcoming corner to discover stories, build curiosity, and foster literacy. Our school library corner currently lacks organized book storage, grade-appropriate literature, and inspiring interior elements.
                </p>
                <p>
                  Instead of running a traditional fundraising campaign where cash is handed to organizers without ongoing verification, <strong>StraightMoney guarantees 100% transparency</strong>:
                </p>

                {/* Highlighted Callout Grid */}
                <div className="grid gap-3 sm:grid-cols-3 pt-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/40">
                    <span className="text-xl">🪵</span>
                    <h3 className="mt-2 text-xs font-black text-[#001435] dark:text-white">1. Shelves ($400)</h3>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      Four modular, heavy-duty bookshelves constructed by local craftsmen (Vendor A).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/40">
                    <span className="text-xl">📚</span>
                    <h3 className="mt-2 text-xs font-black text-[#001435] dark:text-white">2. Books ($600)</h3>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      Over 120 curated educational &amp; fiction books delivered by the bookstore (Vendor B).
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/40">
                    <span className="text-xl">🎨</span>
                    <h3 className="mt-2 text-xs font-black text-[#001435] dark:text-white">3. Paint ($200)</h3>
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                      Safe non-toxic primer, wall colors, and materials supplied by the paint store (Vendor C).
                    </p>
                  </div>
                </div>

                <p className="pt-2 text-xs text-slate-600 dark:text-slate-300">
                  When any vendor delivers their items, they upload an invoice and delivery photograph. Gemini AI checks OCR fields, Python checks hard budget and duplicate rules, and an independent human verifier approves before PayPal sends the payout.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2: Interactive Budget & Spending Matrix */}
          <section id="section-budget" className="space-y-6 scroll-mt-28" aria-labelledby="budget-matrix-heading">
            <div className="surface-card rounded-[2.5rem] border border-white/90 p-7 sm:p-10 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Verified Vendor Spending</p>
                  <h2 id="budget-matrix-heading" className="display-heading mt-2 text-2xl sm:text-3xl text-[#001435] dark:text-white">
                    Interactive Budget Matrix
                  </h2>
                </div>
                <Link
                  href={`/ledger/${campaign.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/90 px-4 py-2 text-xs font-extrabold text-[#003087] hover:bg-blue-100 transition dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                >
                  View Public Ledger &rarr;
                </Link>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Click on any budget line below to inspect assigned vendors, current payouts, and submitted invoices.
              </p>

              {/* Budget Overview KPI Cards */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Paid to Vendors
                  </span>
                  <p className="mt-1 text-2xl font-black text-emerald-950 dark:text-emerald-100 tabular-nums">
                    {money(budgetTotals.paid, campaign.currency)}
                  </p>
                  <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">Confirmed via PayPal Payouts</p>
                </div>

                <div className="rounded-2xl border border-amber-200/90 bg-amber-50/80 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Approved In Queue
                  </span>
                  <p className="mt-1 text-2xl font-black text-amber-950 dark:text-amber-100 tabular-nums">
                    {money(budgetTotals.approvedUnpaid, campaign.currency)}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400">Verifier approved, awaiting transfer</p>
                </div>

                <div className="rounded-2xl border border-blue-200/90 bg-blue-50/80 p-4 dark:border-blue-900/60 dark:bg-blue-950/40">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#003087] dark:text-blue-300">
                    Available / Remaining
                  </span>
                  <p className="mt-1 text-2xl font-black text-[#001435] dark:text-white tabular-nums">
                    {money(budgetTotals.remaining, campaign.currency)}
                  </p>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Open for upcoming invoice submissions</p>
                </div>
              </div>

              {/* Interactive Budget Lines Breakdown */}
              <div className="mt-6 space-y-3">
                {budgetRows.map((row) => {
                  const paidPct = row.planned > 0 ? (row.paid / row.planned) * 100 : 0;
                  const approvedPct = row.planned > 0 ? (row.approvedUnpaid / row.planned) * 100 : 0;
                  const isExpanded = budgetExpandedLine === row.line.id;

                  return (
                    <div
                      key={row.line.id}
                      className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/80"
                    >
                      <div
                        onClick={() => setBudgetExpandedLine(isExpanded ? null : row.line.id)}
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setBudgetExpandedLine(isExpanded ? null : row.line.id);
                          }
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-[#003087] dark:bg-slate-700 dark:text-blue-300">
                              {row.line.name.charAt(0)}
                            </span>
                            <div>
                              <strong className="text-sm font-extrabold text-[#001435] dark:text-white">
                                {row.line.name}
                              </strong>
                              <p className="text-[10px] text-slate-500">
                                Assigned Vendor: <span className="font-semibold text-slate-800 dark:text-slate-200">{row.line.vendor_name ?? "Vendor"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-sm font-black text-[#001435] dark:text-white">
                              {money(row.planned, campaign.currency)}
                            </span>
                            <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {row.invoices.length} invoice{row.invoices.length === 1 ? "" : "s"} &middot; {isExpanded ? "Collapse ▲" : "Details ▼"}
                            </span>
                          </div>
                        </div>

                        {/* Multi-Segment Progress Visualizer */}
                        <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 flex shadow-inner">
                          <span
                            style={{ width: `${paidPct}%` }}
                            className="bg-emerald-500 transition-all duration-500"
                            title={`Paid: ${money(row.paid, campaign.currency)}`}
                          />
                          <span
                            style={{ width: `${approvedPct}%` }}
                            className="bg-amber-400 transition-all duration-500"
                            title={`Approved: ${money(row.approvedUnpaid, campaign.currency)}`}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                          <span>Paid: <strong className="text-emerald-700 dark:text-emerald-400">{money(row.paid, campaign.currency)}</strong></span>
                          <span>Approved: <strong className="text-amber-700 dark:text-amber-400">{money(row.approvedUnpaid, campaign.currency)}</strong></span>
                          <span>Remaining: <strong className="text-slate-700 dark:text-slate-200">{money(row.remaining, campaign.currency)}</strong></span>
                        </div>
                      </div>

                      {/* Expandable Invoice Detail List */}
                      {isExpanded && (
                        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Submitted Invoices for {row.line.name}:
                          </p>
                          {row.invoices.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">No invoices submitted yet for this line item.</p>
                          ) : (
                            row.invoices.map((inv) => (
                              <div
                                key={inv.id}
                                className="flex flex-wrap items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-900/60"
                              >
                                <div>
                                  <span className="font-bold text-[#001435] dark:text-white">
                                    Invoice {inv.invoice_number}
                                  </span>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(inv.created_at).toLocaleDateString()} &middot; {inv.vendor_name}
                                  </p>
                                  {inv.status === "PAID" && <p className="mt-1 text-[10px] text-slate-600">
                                    <strong>Delivery:</strong> {inv.delivery ? `${inv.delivery.delivered_description} · ${inv.delivery.accepted_at ? `accepted ${new Date(inv.delivery.accepted_at).toLocaleDateString()}` : "awaiting acceptance"}${inv.delivery.remaining_issue ? ` · remaining issue: ${inv.delivery.remaining_issue}` : ""}` : "awaiting vendor report"}
                                  </p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={inv.status} />
                                  <span className="font-black text-[#003087] dark:text-[#38bdf8]">
                                    {money(inv.amount, inv.currency)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 3: Interactive Impact Calculator Widget */}
          <section id="section-calculator" className="space-y-6 scroll-mt-28" aria-labelledby="calculator-heading">
            <div className="surface-card overflow-hidden rounded-[2.5rem] border border-white/90 p-7 sm:p-10 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow">Interactive Impact Calculator</p>
                  <h2 id="calculator-heading" className="display-heading mt-2 text-2xl sm:text-3xl text-[#001435] dark:text-white">
                    See What Your Donation Accomplishes
                  </h2>
                </div>
                <span className="text-2xl" aria-hidden="true">💡</span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Choose or slide a contribution amount to see exactly which vendor items your donation helps unlock:
              </p>

              {/* Tier Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {impactTiers.map((tier) => (
                  <button
                    key={tier.amount}
                    type="button"
                    onClick={() => setCalculatorAmount(tier.amount)}
                    className={`rounded-2xl border p-3 text-center transition ${
                      calculatorAmount === tier.amount
                        ? "border-[#0070BA] bg-[#E1F0FC] ring-2 ring-[#0070BA]/30 dark:bg-slate-700 dark:border-blue-400"
                        : "border-slate-200 bg-white hover:border-blue-200 dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    <span className="text-lg" aria-hidden="true">{tier.icon}</span>
                    <strong className="mt-1 block text-sm font-black text-[#001435] dark:text-white">
                      ${tier.amount}
                    </strong>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {tier.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Slider Controller */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Custom amount: <strong className="text-base text-[#003087] dark:text-[#38bdf8]">${calculatorAmount}</strong></span>
                  <span>Max: $500</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={calculatorAmount}
                  onChange={(e) => setCalculatorAmount(Number(e.target.value))}
                  className="mt-3 w-full accent-[#0070BA] cursor-pointer"
                  aria-label="Select custom donation amount for impact visualizer"
                />

                {/* Dynamic Impact Statement */}
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-xs dark:bg-slate-800">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg dark:bg-slate-700">
                    🎯
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-[#001435] dark:text-white">
                      Your ${calculatorAmount} contribution:
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {calculatorAmount < 40 && "Funds 3 to 5 grade-appropriate books directly with Vendor B."}
                      {calculatorAmount >= 40 && calculatorAmount < 100 && "Funds a full reading pack and book display bookends."}
                      {calculatorAmount >= 100 && calculatorAmount < 250 && "Covers custom shelving materials and hardware brackets with Vendor A."}
                      {calculatorAmount >= 250 && calculatorAmount < 400 && "Covers complete library wall primer, colorful paint, and finishing supplies."}
                      {calculatorAmount >= 400 && "Completely funds an entire 4-tier bookshelf delivered and assembled!"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={scrollToDonate}
                  className="button-gold rounded-full px-8 py-3 text-xs font-black shadow-md shadow-[#FFC439]/30 hover:scale-105 transition"
                >
                  Donate ${calculatorAmount} via PayPal Now &rarr;
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 4: Live Delivery Updates & Evidence */}
          <section id="section-updates" className="scroll-mt-28" aria-labelledby="evidence-heading">
            <ProjectUpdates campaignId={campaign.id} />
          </section>

          {/* SECTION 5: Recent Donors & Public Ledger Ribbon */}
          <section id="section-ledger" className="space-y-6 scroll-mt-28" aria-labelledby="ledger-preview-heading">
            <div className="surface-card rounded-[2.5rem] border border-white/90 p-7 sm:p-10 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Public Accountability</p>
                  <h2 id="ledger-preview-heading" className="display-heading mt-2 text-2xl sm:text-3xl text-[#001435] dark:text-white">
                    Verified Captured Donors
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/ledger/${campaign.id}`} className="button-secondary text-xs font-bold">Open Full AG Grid Ledger &rarr;</Link>
                  {!USE_MOCKS && <a href={api.campaignReportUrl(campaign.id)} className="button-secondary text-xs font-bold">Download campaign report (.csv)</a>}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                Only captured PayPal transactions appear here. Simulated demo records carry a SIMULATED label.
              </p>

              {/* Donors List */}
              <div className="mt-5 space-y-2.5">
                {recentDonations.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">
                    No captured donations recorded yet. Be the first to donate!
                  </p>
                ) : (
                  recentDonations.map((d, index) => (
                    <div
                      key={`${d.created_at}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[#003087] dark:bg-slate-700 dark:text-blue-300">
                          {(d.actor_name || "D").charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong className="text-xs font-bold text-[#001435] dark:text-white">{d.actor_name}</strong>
                          <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {new Date(d.created_at).toLocaleDateString()} &middot; Captured
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {d.source === "simulated" && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            SIMULATED
                          </span>
                        )}
                        <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                          +{money(d.amount, campaign.currency)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* SECTION 6: FAQ & Safety Guarantee */}
          <section id="section-faq" className="space-y-4 scroll-mt-28" aria-labelledby="faq-heading">
            <div className="surface-card rounded-[2.5rem] border border-white/90 p-7 sm:p-10 dark:border-slate-800">
              <p className="eyebrow">Clear Answers</p>
              <h2 id="faq-heading" className="display-heading mt-2 text-2xl sm:text-3xl text-[#001435] dark:text-white">
                Frequently Asked Questions
              </h2>

              <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  [
                    "Where does my donation actually go?",
                    "Your payment enters the campaign balance via PayPal Orders v2. The organizer does not receive any cash payout. When a vendor delivers, payouts disburse directly to their registered PayPal account against an approved invoice.",
                  ],
                  [
                    "Who checks that vendors actually delivered?",
                    "Vendors must upload the invoice and a delivery evidence photo. Gemini AI validates the OCR fields and delivery proof relevance. Eight deterministic Python policy rules enforce budget limits, currency, and duplicate checks. Finally, an independent human verifier must approve the payout.",
                  ],
                  [
                    "Does this prototype use real money?",
                    "No. StraightMoney operates strictly on the PayPal Sandbox with synthetic accounts. No real credit card or bank funds are ever deducted.",
                  ],
                  [
                    "What happens if a vendor submits an inflated invoice?",
                    "Hard policy rule #5 strictly rejects any invoice amount that exceeds the remaining budget line amount. The invoice is automatically flagged and rejected without payout.",
                  ],
                ].map(([q, a]) => (
                  <details key={q} className="group py-4">
                    <summary className="cursor-pointer text-sm font-bold text-[#001435] group-open:text-[#0070BA] transition flex items-center justify-between dark:text-white">
                      <span>{q}</span>
                      <span className="text-slate-500 group-open:rotate-180 transition duration-200 dark:text-slate-400">▾</span>
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 pr-6">
                      {a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right Stage: Sticky Donation Sidebar */}
        <aside id="donate-sidebar" className="sticky top-20 space-y-6">
          {/* Main Floating Donation Box */}
          <div className="surface-card rounded-[2.5rem] border border-white/90 p-6 sm:p-8 shadow-2xl shadow-blue-950/10 dark:border-slate-800">
            {/* Live Progress Card */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-[#38bdf8]">
                  Campaign Progress
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {percentFunded}% Funded
                </span>
              </div>

              <ProgressBar current={fundedAmount} goal={campaign.goal_amount} />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {donorCount.toLocaleString()} {donorCount === 1 ? "donor has" : "donors have"} contributed
              </p>

              <div className="flex items-baseline justify-between text-xs">
                <div>
                  <span className="text-2xl font-black text-[#001435] dark:text-white tabular-nums">
                    {money(fundedAmount, campaign.currency)}
                  </span>
                  <span className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                    goal {money(campaign.goal_amount, campaign.currency)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-sm font-extrabold text-[#0070BA] dark:text-[#38bdf8] tabular-nums">
                    {money(campaign.pool_balance, campaign.currency)}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Available in pool</span>
                </div>
              </div>

              {simulatedCount > 0 && (
                <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-900 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-300">
                  <span className="font-bold">SIMULATED:</span> {simulatedCount} demo donation(s) recorded.
                </div>
              )}
            </div>

            {/* PayPal Checkout Button Embedded */}
            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <p className="text-xs font-bold text-[#001435] dark:text-white mb-2">
                Make a Sandbox Donation
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                Captured via PayPal Orders v2 into campaign pool. Payouts are made directly to vendors.
              </p>

              {campaign.status === "active" ? (
                <PayPalDonateButton
                  key={campaign.id}
                  campaignId={campaign.id}
                  campaignTitle={campaign.title}
                  currency={campaign.currency}
                  onCaptured={handlePaymentCaptured}
                />
              ) : (
                <p role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  This campaign is {campaign.status} and is not accepting donations.
                </p>
              )}
            </div>

            {/* Quick Follow Project Button */}
            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              {session?.role === "Donor" ? (
                <button
                  type="button"
                  onClick={() => followCampaign(campaign.id)}
                  className={`w-full rounded-full py-2.5 text-xs font-bold transition ${
                    followed
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "button-secondary"
                  }`}
                >
                  {followed ? "♥ Following Project Updates" : "♡ Follow Project Updates"}
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="block text-center text-xs font-bold text-[#003087] hover:underline dark:text-blue-400"
                >
                  Sign in as a donor to follow &rarr;
                </Link>
              )}
            </div>
          </div>

          {/* Trust Seal Card */}
          <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-blue-50/70 to-slate-50/80 p-5 backdrop-blur-md shadow-xs dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-black">
                ✓
              </span>
              <strong className="text-xs font-black text-[#001435] dark:text-white">
                Buyer &amp; Donor Protection
              </strong>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              Donated funds remain in the PayPal Sandbox balance. Only verified invoice submissions with proof of delivery trigger disbursements.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
