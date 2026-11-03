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
    {lastOutcome && <section role="status" className="surface-card mb-6 p-5"><h2 className="mb-4 text-lg font-semibold">Decision recorded: {lastOutcome.invoice_number}</h2><InvoiceStages invoice={lastOutcome} /><p className="mt-3 text-xs text-slate-600">This is the last recorded outcome. Use the payment queue to check for a later confirmation.</p></section>}
    <div className="mb-6 flex flex-wrap gap-3">{[["AWAITING_VERIFIER", "Pending review"], ["PAYOUT_PENDING", "Payment confirmations"], ["AWAITING_FUNDS", "Awaiting funds"], ["", "All invoices"]].map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => { if (status === value) return; setLoading(true); setStatus(value); }} className={status === value ? "button-primary" : "button-secondary"}>{label}</button>)}</div>
    <div className="mb-6 flex flex-wrap gap-4"><label className="text-sm">Campaign<select value={campaignId ?? ""} onChange={(event) => { setLoading(true); setCampaignId(Number(event.target.value)); }} className="ml-2 rounded border border-slate-300 bg-white p-2">{campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="text-sm">Status<select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); }} className="ml-2 rounded border border-slate-300 p-2"><option value="">All</option><option value="AWAITING_VERIFIER">Awaiting verifier</option><option value="FAILED">Failed payout</option><option value="AWAITING_FUNDS">Awaiting funds</option><option value="PARTIALLY_PAID">Partially paid</option><option value="PAYOUT_PENDING">Payout pending</option><option value="REJECTED">Rejected</option><option value="PAID">Paid</option><option value="NEEDS_REVIEW">Needs review</option></select></label></div>
    {loading && <p role="status">Loading invoices…</p>}
    {error && <div role="alert" className="mb-5 rounded border border-red-200 bg-red-50 p-4 text-red-900"><p>{error}</p><button type="button" className="button-secondary mt-3" onClick={() => { setError(null); setLoading(true); if (campaignId === null) setCampaignListKey((key) => key + 1); else setRefreshKey((key) => key + 1); }}>Refresh queue</button></div>}
    {!loading && !error && invoices.length === 0 && <p>No invoices match this queue. Choose All invoices to inspect other review and payment states.</p>}
    {invoices.length > 0 && <div className="mb-6 flex flex-wrap gap-2">{invoices.map((item) => <button type="button" key={item.id} aria-pressed={selectedId === item.id} onClick={() => { if (selectedId === item.id) return; setInvoice(null); setDetailLoading(true); setSelectedId(item.id); }} className={`rounded border px-3 py-2 text-sm ${selectedId === item.id ? "border-brand-700 bg-brand-50" : "border-slate-300 bg-white"}`}>{item.invoice_number}<span className="mt-1 block text-xs text-slate-600">{invoiceStages(item).review} / {invoiceStages(item).payment}</span></button>)}</div>}
    {detailLoading && !error && <p role="status">Loading invoice details…</p>}
    {!loading && !detailLoading && !error && invoice && invoices.some((item) => item.id === invoice.id) && <VerifierReview key={`${invoice.id}-${refreshKey}`} invoice={invoice} onChanged={(updated) => { setLastOutcome(updated); setLoading(true); setRefreshKey((key) => key + 1); }} />}
  </div>;
}
