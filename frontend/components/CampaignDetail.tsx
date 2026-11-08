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

function lineStatus(invoices: Invoice[]) {
  if (invoices.some((invoice) => invoice.delivery?.accepted_at)) return "Delivered";
  if (invoices.some((invoice) => invoice.status === "PAID")) return "Paid";
  if (invoices.some((invoice) => ["VERIFIER_APPROVED", "PAYOUT_PENDING", "PARTIALLY_PAID"].includes(invoice.status))) return "Approved";
  if (invoices.some((invoice) => invoice.status === "FAILED")) return "Payout pending";
  if (invoices.some((invoice) => invoice.status === "REJECTED" || invoice.status === "VERIFIER_REJECTED")) return "Rejected";
  if (invoices.length > 0) return "In review";
  return "Awaiting vendor";
}

export default function CampaignDetail({ id }: { id: number }) {
  const session = useDemoSession();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.getCampaign(id), api.getInvoices(id).catch(() => []), api.getLedger(id).catch(() => [])])
      .then(([item, invoiceRows, entries]) => {
        if (active) {
          setCampaign(item);
          setInvoices(invoiceRows);
          setLedger(entries);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Campaign unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const refresh = async () => {
    const [item, invoiceRows, entries] = await Promise.all([
      api.getCampaign(id), api.getInvoices(id).catch(() => []), api.getLedger(id).catch(() => []),
    ]);
    setCampaign(item);
    setInvoices(invoiceRows);
    setLedger(entries);
  };

  const donorCount = useMemo(() => ledger.filter((entry) => entry.type === "donation" && entry.status === "captured" &&
    (entry.donation_id == null || entry.amount + ledger.filter((adjustment) => adjustment.donation_id === entry.donation_id && (adjustment.type === "refund" || adjustment.type === "dispute"))
      .reduce((sum, adjustment) => sum + adjustment.amount, 0) > 0)).length, [ledger]);

  if (loading) return <main id="main-content" tabIndex={-1} className="page-width py-16"><p role="status" className="text-sm text-slate-600">Loading campaign…</p></main>;
  if (error || !campaign) return (
    <main id="main-content" tabIndex={-1} className="page-width py-16">
      <h1 className="text-2xl font-bold">Campaign unavailable</h1>
      <p className="mt-2 text-sm text-slate-600">{error ?? "Campaign not found."}</p>
      <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }} className="button-primary mt-5 text-sm">Try again</button>
    </main>
  );

  const funded = totalFunded(campaign);
  const image = campaignImagery(campaign.title, "detail");
  const followed = session?.followed.includes(id) ?? false;
  const adjustments = ledger.filter((entry) => entry.type === "refund" || entry.type === "dispute");

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-8 sm:py-12">
      <Link href="/explore/public-causes" className="text-sm font-medium text-[#003087] dark:text-sky-300">&larr; Public causes</Link>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-9">
          <header>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <StatusBadge status={campaign.status} />
              <span>By {campaign.organizer_name}</span>
            </div>
            <h1 className="display-heading mt-4 text-4xl text-[#001435] dark:text-white sm:text-5xl">{campaign.title}</h1>
            {campaign.description && <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">{campaign.description}</p>}
          </header>

          {(campaign.cancelled_at || adjustments.length > 0) && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {campaign.cancelled_at && <p><strong>Campaign cancelled.</strong> {campaign.cancellation_reason}</p>}
              {adjustments.map((entry, index) => <p key={`${entry.created_at}-${index}`} className="mt-1">{entry.type === "refund" ? "Refund" : "Dispute"}: {money(Math.abs(entry.amount), campaign.currency)} · {entry.status.replaceAll("_", " ")}</p>)}
            </div>
          )}

          <div className="relative h-64 overflow-hidden rounded-2xl bg-slate-100 sm:h-96">
            <Image src={image.src} alt={image.alt} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
            <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-xs text-white">Illustrative photo</span>
          </div>

          <section aria-labelledby="budget-heading">
            <h2 id="budget-heading" className="text-2xl font-bold text-[#001435] dark:text-white">Budget</h2>
            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {campaign.budget_lines.map((line) => {
                const row = budgetSummary(line, invoices);
                const status = lineStatus(invoices.filter((invoice) => invoice.budget_line_id === line.id));
                return (
                  <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                    <div>
                      <h3 className="font-semibold text-[#001435] dark:text-white">{line.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{status}</p>
                    </div>
                    <div className="text-right">
                      <strong className="text-sm text-[#001435] dark:text-white">{money(row.planned, campaign.currency)}</strong>
                      {row.paid > 0 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{money(row.paid, campaign.currency)} paid</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-2xl font-bold text-[#001435] dark:text-white">Delivery updates</h2>
            {invoices.filter((invoice) => invoice.delivery).length === 0 ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No delivery updates yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {[...invoices].filter((invoice) => invoice.delivery)
                  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                  .filter((invoice, index, rows) => rows.findIndex((item) => item.budget_line_id === invoice.budget_line_id) === index)
                  .slice(0, 3).map((invoice) => {
                  const proof = api.assetUrl(invoice.evidence_path);
                  return (
                    <article key={invoice.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold text-[#001435] dark:text-white">{invoice.budget_line_name ?? invoice.invoice_number}</h3>
                        <StatusBadge status={invoice.status} />
                      </div>
                      {invoice.delivery?.delivered_description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{invoice.delivery.delivered_description}</p>}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>{new Date(invoice.created_at).toLocaleDateString()}</span>
                        {proof && <a href={proof} target="_blank" rel="noreferrer" className="font-semibold text-[#003087] dark:text-sky-300">View evidence</a>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-5 border-t border-slate-200 pt-5 text-sm font-semibold text-[#003087] dark:border-slate-800 dark:text-sky-300">
            <Link href={`/ledger/${campaign.id}`}>Public ledger</Link>
            {!USE_MOCKS && <a href={api.campaignReportUrl(campaign.id)}>Download campaign report</a>}
          </div>
        </div>

        <aside id="donate" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-20">
          <h2 className="text-xl font-bold text-[#001435] dark:text-white">Support this campaign</h2>
          <p className="mt-4 text-2xl font-bold text-[#001435] dark:text-white">{money(funded, campaign.currency)} <span className="text-sm font-normal text-slate-500">raised of {money(campaign.goal_amount, campaign.currency)}</span></p>
          <div className="mt-3"><ProgressBar current={funded} goal={campaign.goal_amount} /></div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{donorCount.toLocaleString()} {donorCount === 1 ? "donor has" : "donors have"} contributed</p>
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
            {campaign.status === "active" ? (
              <PayPalDonateButton key={campaign.id} campaignId={campaign.id} campaignTitle={campaign.title} currency={campaign.currency} onCaptured={refresh} />
            ) : (
              <p role="status" className="text-sm text-slate-600 dark:text-slate-300">This campaign is not accepting donations.</p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            <button type="button" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); }} className="hover:text-[#003087]">{copied ? "Link copied" : "Share"}</button>
            {session ? <button type="button" onClick={() => followCampaign(campaign.id)} className="hover:text-[#003087]">{followed ? "Following" : "Follow"}</button> : <Link href="/signin" className="hover:text-[#003087]">Follow</Link>}
          </div>
        </aside>
      </div>
    </main>
  );
}
