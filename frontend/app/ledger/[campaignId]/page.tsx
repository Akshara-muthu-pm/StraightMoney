"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import FulfillmentProgress from "@/components/FulfillmentProgress";
import PaymentModelNotice from "@/components/PaymentModelNotice";
import LedgerGrid from "@/components/LedgerGrid";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign, LedgerEntry } from "@/lib/types";

export default function LedgerPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const id = Number(campaignId);
  const [view, setView] = useState<"financial" | "fulfillment">("financial");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) return;
    let active = true;
    Promise.all([api.getCampaign(id), api.getLedger(id)]).then(([item, rows]) => {
      if (active) { setCampaign(item); setEntries(rows); setError(null); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load the ledger.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const financial = entries.filter((entry) => ["donation", "payout", "refund", "dispute"].includes(entry.type));
  const total = (type: string, status: string) => entries.filter((item) => item.type === type && item.status === status).reduce((sum, item) => sum + item.amount, 0);
  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087]">Public Transparency Record</p>
      </div>
      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#001435]">Public Ledger</h1>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {campaign?.title ?? "Campaign"} &middot; Confirmed donations in, confirmed vendor payments out; fulfillment is tracked separately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {campaign && !USE_MOCKS && <a href={api.campaignReportUrl(campaign.id)} className="button-secondary text-xs font-bold">Download report (.csv)</a>}
          <Link href={campaign ? `/campaigns/${campaign.id}` : "/explore"} className="inline-flex items-center gap-1 text-xs font-bold text-[#003087] hover:text-[#0070BA] underline">&larr; Back to campaign story</Link>
        </div>
      </div>
      {!Number.isInteger(id) || id < 1 ? <p role="alert" className="liquid-glass border-red-200 p-4 text-xs font-bold text-red-900">Invalid campaign ID.</p> : null}
      {loading && <p role="status" className="liquid-glass p-6 text-xs text-slate-500">Loading ledger…</p>}
      {error && <p role="alert" className="liquid-glass border-red-200 p-4 text-xs font-bold text-red-900">{error}</p>}
      {!loading && !error && campaign && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            {[
              ["Donated · PayPal Sandbox", `$${financial.filter((e) => e.type === "donation" && e.source !== "simulated" && ["donated","captured"].includes(e.status)).reduce((sum,e)=>sum+e.amount,0).toFixed(2)}`, "#10B981"],
              ["Simulated test donations", `$${financial.filter((e) => e.type === "donation" && e.source === "simulated").reduce((sum,e)=>sum+e.amount,0).toFixed(2)}`, "#FFC439"],
              ["Vendor payouts", `$${total("payout", "success").toFixed(2)}`, "#0070BA"],
              ["Refund / dispute adjustments", `$${financial.filter((e)=>e.type === "refund" || e.type === "dispute").reduce((sum,e)=>sum+e.amount,0).toFixed(2)}`, "#FFC439"]
            ].map(([label, value, accent]) => (
              <div key={label} className="liquid-glass p-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                </div>
                <p className="mt-3 text-3xl font-black text-[#001435] tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <PaymentModelNotice />
          <div className="mb-5 flex flex-wrap gap-3" aria-label="Ledger views"><button className={view === "financial" ? "button-primary" : "button-secondary"} aria-pressed={view === "financial"} onClick={()=>setView("financial")}>Financial records</button><button className={view === "fulfillment" ? "button-primary" : "button-secondary"} aria-pressed={view === "fulfillment"} onClick={()=>setView("fulfillment")}>Fulfillment progress</button></div>
          {view === "financial" ? <div className="liquid-glass p-5"><p className="mb-4 text-sm">Donations are money received. Payouts are confirmed money sent. Negative adjustments reduce available funds. Test contributions are labelled separately. Donor identities and payment-provider references are not published.</p><LedgerGrid key={campaign.id} campaignId={campaign.id} entries={financial} /></div> : <FulfillmentProgress campaignId={campaign.id} />}
          {USE_MOCKS && <p className="mt-4 text-xs text-slate-400">Demo data for the UI preview.</p>}
        </>
      )}
    </main>
  );
}
