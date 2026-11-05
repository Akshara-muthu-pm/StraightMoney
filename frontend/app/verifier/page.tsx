"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import InvoiceStages from "@/components/InvoiceStages";
import { invoiceStages } from "@/lib/presentation";
import VerifierReview from "@/components/VerifierReview";
import { api } from "@/lib/api";
import type { CampaignSummary, Invoice } from "@/lib/types";

export default function VerifierPage() {
  return <DashboardShell role="Verifier" title="Careful review. Clear outcomes." description="Start with the pending queue, inspect evidence and checks, then decide. Approval may still await funds or payment confirmation." steps={["Open queue", "Inspect evidence", "Decide", "Check payment"]}><VerifierQueue /></DashboardShell>;
}
function VerifierQueue() {
  const [issues, setIssues] = useState<Array<{ id: number; detail: string; reference: string | null }>>([]);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [status, setStatus] = useState("AWAITING_VERIFIER");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailKey, setDetailKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [campaignListKey, setCampaignListKey] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<Invoice | null>(null);

  useEffect(() => {
    let active = true;
    api.reconciliationIssues().then((items) => { if (active) setIssues(items); }).catch(() => {});
    api.listCampaigns().then((items) => {
      if (active) { setCampaigns(items); setCampaignId(items[0]?.id ?? null); setLoading(items.length > 0); }
    }).catch((cause: unknown) => {
      if (active) { setError(cause instanceof Error ? cause.message : "Could not load campaigns."); setLoading(false); }
    });
    return () => { active = false; };
  }, [campaignListKey]);

  useEffect(() => {
    if (campaignId === null) return;
    let active = true;
    api.getInvoices(campaignId, status || undefined).then((items) => {
      if (!active) return;
      setInvoices(items);
      setInvoice(null);
      setSelectedId(items[0]?.id ?? null);
      setDetailKey((key) => key + 1);
      setDetailLoading(items.length > 0);
      setError(null);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load invoices.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaignId, status, refreshKey]);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    api.getInvoice(selectedId).then((item) => {
      if (active) { setInvoice(item); setError(null); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load invoice details.");
    }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, detailKey]);

  return <div>
    {issues.length > 0 && <section role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-xs text-amber-950">
      <h2 className="text-sm font-bold">Payment records needing reconciliation</h2>
      <ul className="mt-2 list-inside list-disc space-y-1">{issues.map((item) => <li key={item.id}>{item.reference ? `${item.reference}: ` : ""}{item.detail}</li>)}</ul>
    </section>}
    {lastOutcome && (
      <section role="status" className="liquid-glass mb-6 p-6">
        <h2 className="mb-4 text-base font-extrabold text-[#001435]">Decision recorded: {lastOutcome.invoice_number}</h2>
        <InvoiceStages invoice={lastOutcome} />
        <p className="mt-3 text-xs text-slate-500">This is the last recorded outcome. Use the payment queue to check for later PayPal confirmation.</p>
      </section>
    )}
    <div className="mb-6 flex flex-wrap gap-2.5">
      {[
        ["AWAITING_VERIFIER", "Pending review"],
        ["PAYOUT_PENDING", "Payment confirmations"],
        ["AWAITING_FUNDS", "Awaiting funds"],
        ["", "All invoices"]
      ].map(([value, label]) => (
        <button
          type="button"
          key={value}
          aria-pressed={status === value}
          onClick={() => { if (status === value) return; setLoading(true); setStatus(value); }}
          className={status === value ? "button-primary text-xs" : "button-secondary text-xs"}
        >
          {label}
        </button>
      ))}
    </div>
    <div className="mb-6 flex flex-wrap items-center gap-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
      <label className="flex items-center">
        Campaign
        <select
          value={campaignId ?? ""}
          onChange={(event) => { setLoading(true); setCampaignId(Number(event.target.value)); }}
          className="ml-2 rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2 text-xs font-bold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none"
        >
          {campaigns.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center">
        Status
        <select
          value={status}
          onChange={(event) => { setLoading(true); setStatus(event.target.value); }}
          className="ml-2 rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2 text-xs font-bold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none"
        >
          <option value="">All</option>
          <option value="AWAITING_VERIFIER">Awaiting verifier</option>
          <option value="FAILED">Failed payout</option>
          <option value="AWAITING_FUNDS">Awaiting funds</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAYOUT_PENDING">Payout pending</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
          <option value="NEEDS_REVIEW">Needs review</option>
        </select>
      </label>
    </div>
    {loading && <p role="status" className="text-xs text-slate-500">Loading invoices…</p>}
    {error && (
      <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-xs text-red-900">
        <p className="font-bold">{error}</p>
        <button
          type="button"
          className="button-secondary mt-3 text-xs"
          onClick={() => { setError(null); setLoading(true); if (campaignId === null) setCampaignListKey((key) => key + 1); else setRefreshKey((key) => key + 1); }}
        >
          Refresh queue
        </button>
      </div>
    )}
    {!loading && !error && invoices.length === 0 && (
      <div className="liquid-glass my-6 flex flex-col items-center justify-center p-10 sm:p-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#003087]/15 to-[#0070BA]/20 text-[#003087] shadow-inner ring-1 ring-blue-200/60 dark:from-sky-950/40 dark:to-blue-900/40 dark:text-[#38bdf8] dark:ring-white/10">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h3 className="mt-5 text-xl font-extrabold tracking-tight text-[#001435] dark:text-white">
          Verifier Queue is Clear
        </h3>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          No invoices currently match the <span className="font-bold text-[#003087] dark:text-[#38bdf8]">&ldquo;{status ? status.replace(/_/g, " ").toLowerCase() : "all"}&rdquo;</span> filter. All compliance checks have been processed or are awaiting vendor submission.
        </p>
        {status ? (
          <button
            type="button"
            onClick={() => { setLoading(true); setStatus(""); }}
            className="button-secondary mt-6 text-xs font-bold"
          >
            Switch to &ldquo;All invoices&rdquo; &rarr;
          </button>
        ) : null}
      </div>
    )}
    {invoices.length > 0 && (
      <div className="mb-6 flex flex-wrap gap-2.5">
        {invoices.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selectedId === item.id}
            onClick={() => { if (selectedId === item.id) return; setInvoice(null); setDetailLoading(true); setSelectedId(item.id); }}
            className={`rounded-2xl border p-3.5 text-left text-xs font-bold transition ${
              selectedId === item.id
                ? "border-[#003087] bg-[#E1F0FC] text-[#003087] shadow-sm ring-1 ring-[#003087]/30"
                : "border-white/80 bg-white/70 text-slate-700 backdrop-blur-md hover:border-[#0070BA] hover:bg-white"
            }`}
          >
            <span className="block text-sm font-extrabold text-[#001435]">{item.invoice_number}</span>
            <span className="mt-1 block text-[11px] font-semibold text-slate-500">
              {invoiceStages(item).review} &middot; {invoiceStages(item).payment}
            </span>
          </button>
        ))}
      </div>
    )}
    {detailLoading && !error && <p role="status" className="text-xs text-slate-500">Loading invoice details…</p>}
    {!loading && !detailLoading && !error && invoice && invoices.some((item) => item.id === invoice.id) && (
      <VerifierReview
        key={`${invoice.id}-${refreshKey}`}
        invoice={invoice}
        onChanged={(updated) => { setLastOutcome(updated); setLoading(true); setRefreshKey((key) => key + 1); }}
      />
    )}
  </div>;
}
