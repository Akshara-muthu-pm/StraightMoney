"use client";

import Link from "next/link";
import Image from "next/image";
import ProjectUpdates from "@/components/ProjectUpdates";
import { useDemoSession, followCampaign } from "@/lib/demo-session";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import PayPalDonateButton from "@/components/PayPalDonateButton";
import BudgetOverview from "@/components/BudgetOverview";
import ProgressBar from "@/components/ProgressBar";
import StatusBadge from "@/components/StatusBadge";
import { campaignImagery } from "@/lib/campaign-imagery";

const money = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CampaignDetail({ id }: { id: number }) {
  const session = useDemoSession();
  const selectedId = id;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [ledgerCount, setLedgerCount] = useState<number | null>(null);
  const [simulatedCount, setSimulatedCount] = useState(0);
  const [ledgerError, setLedgerError] = useState(false);
  const [budgetRefresh, setBudgetRefresh] = useState(0);

  const refreshAfterCapture = async () => {
        const [updated, entries] = await Promise.all([api.getCampaign(selectedId), api.getLedger(selectedId)]);
    setCampaign(updated);
    setLedgerCount(entries.length);
    setSimulatedCount(entries.filter((entry) => entry.type === "donation" && entry.source === "simulated" && entry.status === "captured").length);
    setLedgerError(false);
    setBudgetRefresh((value) => value + 1);
  };
  useEffect(() => {
        let active = true;
    api.getCampaign(selectedId).then((item) => { if (active) setCampaign(item); }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load campaign details.");
    }).finally(() => { if (active) setLoadingDetail(false); });
    return () => { active = false; };
  }, [selectedId, retryKey]);

  useEffect(() => {
    let active = true;
    api.getLedger(selectedId).then((entries) => {
      if (active) { setSimulatedCount(entries.filter((entry) => entry.type === "donation" && entry.source === "simulated" && entry.status === "captured").length); setLedgerError(false); }
    }).catch(() => { if (active) setLedgerError(true); });
    return () => { active = false; };
  }, [selectedId, retryKey]);

  // Resolve anchors after fetched content is mounted, including donation/update links.
  useEffect(() => {
    if (loadingDetail) return;
    const anchor = window.location.hash.slice(1) || "campaign-story";
    const target = document.getElementById(anchor);
    if (!target) return;
    const frame = requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [id, loadingDetail]);

  return <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-10">
    <div id="campaign-story" className="space-y-8 scroll-mt-28">
    <Link href="/#campaigns" className="text-sm font-semibold text-brand-800 underline">Back to all campaigns</Link>
    {(loadingDetail || error) && <h1 className="display-heading text-4xl">Campaign story</h1>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900"><p>{error}</p><button type="button" onClick={() => { setError(null); setLoadingDetail(true); setCampaign(null); setRetryKey((key) => key + 1); }} className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold">Try again</button></div>}
    {loadingDetail && <p role="status" className="text-slate-600">Loading campaign details...</p>}
    {!loadingDetail && !error && campaign && <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087]">Community campaign</p>
        <StatusBadge status={campaign.status} />
      </div>
      <div id="campaign-detail" className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-500">Organized by <strong className="text-[#001435]">{campaign.organizer_name}</strong></p>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#001435] sm:text-5xl">{campaign.title}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">{campaign.description}</p>
          </div>
          <figure className="relative h-72 overflow-hidden rounded-3xl shadow-lg shadow-blue-950/10 ring-1 ring-black/5 sm:h-96">
            <Image src={campaignImagery(campaign.title, "detail").src} alt={campaignImagery(campaign.title, "detail").alt} fill sizes="(max-width: 1024px) 100vw, 60vw" preload className="object-cover image-reveal" />
            <figcaption className="photo-label">Illustrative photo / not delivery evidence</figcaption>
          </figure>
          
          <div className="liquid-glass p-6 sm:p-7">
            <ProgressBar current={campaign.pool_balance + campaign.budget_lines.reduce((total, line) => total + line.paid_amount, 0)} goal={campaign.goal_amount} />
            <p className="mt-3 text-xs font-medium text-slate-500">Funding includes available escrow funds and verified vendor payouts.</p>
            {simulatedCount > 0 && <p className="mt-2 text-xs font-semibold text-amber-900"><span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">SIMULATED</span> {simulatedCount} donation{simulatedCount === 1 ? "" : "s"} in this campaign used no PayPal payment.</p>}
            {ledgerError && <p role="status" className="mt-2 text-xs text-slate-500">Donation sources are unavailable. Check the public ledger later.</p>}
          </div>

          <div className="liquid-glass-dark rounded-3xl p-6 text-white shadow-2xl sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full border-[28px] border-white/10" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#009CDE] animate-pulse" />
                <p className="text-xs font-extrabold uppercase tracking-widest text-[#BAE0FC]">Verified Escrow Pool</p>
              </div>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-100/80">Available for the project</p>
                  <p className="mt-2 break-words text-4xl font-black tracking-tight text-white">{money(campaign.pool_balance)}</p>
                </div>
                <div className="sm:border-l sm:border-white/15 sm:pl-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-100/80">Campaign goal</p>
                  <p className="mt-2 break-words text-3xl font-extrabold tracking-tight text-white/90">{money(campaign.goal_amount)}</p>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-2.5 border-t border-white/15 pt-5">
                <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white/95 backdrop-blur-md">
                  {campaign.budget_lines.length} budget categories
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white/95 backdrop-blur-md">
                  Human &amp; AI-reviewed payouts
                </span>
                <span className="rounded-full border border-[#FFC439]/40 bg-[#FFC439]/15 px-3.5 py-1 text-xs font-bold text-[#FFC439] backdrop-blur-md">
                  Zero Organizer Cash Holding
                </span>
              </div>
            </div>
          </div>
          <BudgetOverview key={`${campaign.id}-${budgetRefresh}`} campaign={campaign} />
        </section>

        <aside id="donate" className="liquid-glass self-start p-6 sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087]">Support the campaign</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">Direct Escrow</span>
          </div>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435]">Make a donation</h3>
          <p className="mb-6 mt-2 text-xs leading-relaxed text-slate-600">
            Donations go directly into locked campaign escrow. A verifier reviews vendor invoices and evidence before payouts are disbursed.
          </p>
          {campaign.status === "active" ? (
            <PayPalDonateButton key={campaign.id} campaignId={campaign.id} campaignTitle={campaign.title} currency={campaign.currency} onCaptured={refreshAfterCapture} />
          ) : (
            <p role="status" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">This campaign is {campaign.status} and is not accepting donations.</p>
          )}
          <div className="mt-6 border-t border-slate-200/80 pt-5">
            {session?.role === "Donor" ? (
              <button
                type="button"
                aria-pressed={session.followed.includes(id)}
                className="button-secondary w-full text-xs font-bold"
                onClick={() => followCampaign(id)}
              >
                {session.followed.includes(id) ? "Following this project" : "Follow this project"}
              </button>
            ) : (
              <Link href="/signin" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#003087] hover:underline">
                Sign in as a donor to follow progress &rarr;
              </Link>
            )}
          </div>
        </aside>
      </div>
    <ProjectUpdates key={`${id}-${ledgerCount}-${campaign.pool_balance}`} campaignId={id} />
    </>}
    <section aria-labelledby="questions-heading" className="liquid-glass p-6 sm:p-8">
      <h2 id="questions-heading" className="text-2xl font-extrabold tracking-tight text-[#001435]">A little more clarity</h2>
      <div className="mt-4 divide-y divide-slate-200/80">
        {[
          ["Where does my donation go?", "Donations enter the campaign escrow pool. Vendors receive payouts for approved invoices against the campaign budget; the organizer does not receive the payout."],
          ["Who checks the spending?", "Policy checks review each invoice, and a human verifier reviews the invoice and delivery evidence before approving a payout."],
          ["Does this demo use real money?", "No. Checkout uses PayPal Sandbox test accounts. Simulated donations are separate demo actions, and frontend mock mode does not save donations."]
        ].map(([question, answer]) => (
          <details key={question} className="py-4">
            <summary className="cursor-pointer py-1 font-bold text-[#001435] hover:text-[#0070BA] transition">{question}</summary>
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
    </section>
    </div>
  </main>;
}
