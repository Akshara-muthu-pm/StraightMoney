"use client";

import Link from "next/link";
import Image from "next/image";
import ProjectUpdates from "@/components/ProjectUpdates";
import { useDemoSession, followCampaign } from "@/lib/demo-session";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Campaign } from "@/lib/types";
import PayPalDonateButton from "@/components/PayPalDonateButton";
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

  const refreshAfterCapture = async () => {
        const [updated, entries] = await Promise.all([api.getCampaign(selectedId), api.getLedger(selectedId)]);
    setCampaign(updated);
    setLedgerCount(entries.length);
  };
  useEffect(() => {
        let active = true;
    api.getCampaign(selectedId).then((item) => { if (active) setCampaign(item); }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load campaign details.");
    }).finally(() => { if (active) setLoadingDetail(false); });
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
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Community campaign</p><StatusBadge status={campaign.status} /></div>
      <div id="campaign-detail" className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-6">
          <div><p className="mb-2 text-sm text-slate-600">Organized by {campaign.organizer_name}</p><h1 className="display-heading text-4xl sm:text-5xl">{campaign.title}</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{campaign.description}</p></div>
          <figure className="relative h-72 overflow-hidden rounded-3xl sm:h-96"><Image src={campaignImagery(campaign.title, "detail").src} alt={campaignImagery(campaign.title, "detail").alt} fill sizes="(max-width: 1024px) 100vw, 60vw" preload className="object-cover image-reveal" /><figcaption className="photo-label">Illustrative photo / not delivery evidence</figcaption></figure>
          <div className="surface-card rounded-2xl p-6"><ProgressBar current={campaign.pool_balance + campaign.budget_lines.reduce((total, line) => total + line.paid_amount, 0)} goal={campaign.goal_amount} /><p className="mt-3 text-sm text-slate-600">Funding includes available funds and completed vendor payouts.</p></div>
          <div className="relative overflow-hidden rounded-3xl border border-brand-400/40 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-6 text-white shadow-xl shadow-brand-900/15 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full border-[24px] border-white/10" />
            <div className="relative"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">Community funding</p><div className="mt-6 grid gap-6 sm:grid-cols-2"><div><p className="text-sm text-brand-100">Available for the project</p><p className="mt-2 break-words text-4xl font-bold tracking-tight">{money(campaign.pool_balance)}</p></div><div className="sm:border-l sm:border-white/20 sm:pl-6"><p className="text-sm text-brand-100">Campaign goal</p><p className="mt-2 break-words text-3xl font-semibold tracking-tight">{money(campaign.goal_amount)}</p></div></div><div className="mt-7 flex flex-wrap gap-3 border-t border-white/20 pt-5"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium">{campaign.budget_lines.length} budget categories</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium">Human-reviewed payouts</span></div></div>
          </div>
          <div className="surface-card p-6 sm:p-8"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-xl font-bold">Your contributions at work</h3><Link href={`/ledger/${campaign.id}`} className="text-sm font-semibold text-brand-700 hover:underline">View public ledger &rarr;</Link></div>{ledgerCount !== null && <p role="status" className="text-sm text-slate-500">Ledger refreshed &middot; {ledgerCount} entries</p>}<div className="divide-y divide-slate-200">{campaign.budget_lines.map((line) => <details key={line.id} className="py-4"><summary className="cursor-pointer rounded-lg py-2"><span className="ml-2 font-semibold">{line.name}</span><span className="ml-3 text-sm text-slate-600">{money(Math.max(0, line.budgeted_amount - line.paid_amount))} remaining</span></summary><div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">Assigned vendor: <strong className="text-slate-900">{line.vendor_name ?? "Vendor pending"}</strong></p><p className="text-sm text-slate-600">{money(line.paid_amount)} paid of {money(line.budgeted_amount)} budgeted</p><ProgressBar current={line.paid_amount} goal={line.budgeted_amount} caption="Paid" label={`${line.name} budget paid`} /></div></details>)}</div></div>
        </section>
        <aside id="donate" className="surface-card self-start rounded-3xl p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Support the campaign</p><h3 className="mt-2 text-2xl font-bold">Make a donation</h3><p className="mb-6 mt-2 text-sm leading-6 text-slate-600">Donations go toward approved budget lines. A human verifier reviews each vendor invoice before payout.</p>{campaign.status === "active" ? <PayPalDonateButton key={campaign.id} campaignId={campaign.id} campaignTitle={campaign.title} currency={campaign.currency} onCaptured={refreshAfterCapture} /> : <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">This campaign is {campaign.status} and is not accepting donations.</p>}<div className="mt-5 border-t border-slate-200 pt-5">{session?.role === "Donor" ? <button type="button" aria-pressed={session.followed.includes(id)} className="button-secondary w-full" onClick={() => followCampaign(id)}>{session.followed.includes(id) ? "Following this project" : "Follow this project"}</button> : <Link href="/signin" className="text-sm font-semibold text-brand-800 underline">Sign in as a donor to follow progress</Link>}</div></aside>
      </div>
    <ProjectUpdates key={`${id}-${ledgerCount}-${campaign.pool_balance}`} campaignId={id} />
    </>}
    <section aria-labelledby="questions-heading" className="surface-card p-6 sm:p-8"><h2 id="questions-heading" className="text-2xl font-bold">A little more clarity</h2><div className="mt-4 divide-y divide-slate-200">{[["Where does my donation go?", "Donations enter the campaign pool. Vendors receive payouts for approved invoices against the campaign budget; the organizer does not receive the payout."], ["Who checks the spending?", "Policy checks review each invoice, and a human verifier reviews the invoice and delivery evidence before approving a payout."], ["Does this demo use real money?", "No. Checkout uses PayPal Sandbox test accounts. Simulated donations are separate demo actions, and frontend mock mode does not save donations."]].map(([question, answer]) => <details key={question} className="py-4"><summary className="cursor-pointer rounded-lg py-2 font-semibold">{question}</summary><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{answer}</p></details>)}</div></section>
    </div>
  </main>;
}
