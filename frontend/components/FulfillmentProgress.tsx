"use client";
import {useEffect, useState} from "react";
import {api} from "@/lib/api";
import type {CampaignProgress} from "@/lib/types";
import {money} from "@/lib/presentation";

export default function FulfillmentProgress({campaignId}: {campaignId: number}) {
  const [progress,setProgress] = useState<CampaignProgress | null>(null);
  const [error,setError] = useState("");
  const [revision,setRevision] = useState(0);
  useEffect(() => {let active=true; api.progress(campaignId).then((value) => {if(active) {setProgress(value);setError("");}}).catch((e:unknown) => {if(active) setError(e instanceof Error ? e.message : "Progress unavailable.");});return()=>{active=false;};},[campaignId,revision]);
  return <section className="space-y-5 text-slate-800 dark:text-slate-100"><div><h2 className="text-xl font-extrabold">Fulfillment progress</h2><p className="mt-2 text-sm">Funding, evidence, review, approval and confirmed vendor payment are separate checkpoints. Funding does not establish delivery; approval does not establish payment.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-300 p-4">{error} <button className="underline" onClick={()=>setRevision((x)=>x+1)}>Retry</button></p>}
    {!progress && !error && <p role="status">Loading fulfillment progress…</p>}
    {progress && <><div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950"><strong>{progress.funded ? "Funded" : "Fundraising in progress"}</strong><p className="mt-1 text-sm">{money(progress.raised,progress.currency)} of {money(progress.goal,progress.currency)} recorded. Funding can include explicitly labelled simulated test donations.</p></div>
    {!progress.claims.length && <p className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">No vendor evidence submitted yet.</p>}
    {progress.claims.map((claim)=><article key={claim.reference} className="liquid-glass space-y-4 p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-extrabold">{claim.budget_line}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{claim.vendor} · {claim.reference}</p></div><strong>{money(claim.amount,claim.currency)}</strong></div>
      <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">{[
        ["Evidence submitted",claim.evidence_submitted ? "Files submitted; receipt is not yet established." : "Invoice or delivery evidence incomplete."],
        ["Under review",claim.review_status === "ESCALATED" ? "Escalated for investigation." : claim.review_status === "MORE_EVIDENCE_REQUIRED" ? "Vendor correction requested." : claim.review_status === "NEEDS_REVIEW" ? "Screening incomplete; vendor correction needed." : ["REJECTED","VERIFIER_REJECTED"].includes(claim.review_status) ? "Claim rejected." : claim.approved ? "Review decision recorded." : "Independent review is required."],
        ["Approved",claim.approved ? "Claim approved; payment is a separate step." : "No payment authorization recorded."],
        ["Vendor paid",claim.vendor_paid ? "PayPal confirmed the complete payout." : claim.payment_mode === "simulated" ? "SIMULATED — no vendor funds sent." : claim.payment_status === "failed" ? "Payment failed; no confirmed payout." : claim.confirmed_paid > 0 ? `${money(claim.confirmed_paid,claim.currency)} confirmed; balance remains unpaid.` : claim.payment_status === "pending" ? "PayPal confirmation pending; not recorded as paid." : "No confirmed vendor payment."]
      ].map(([title,detail])=><li key={title} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><strong>{title}</strong><p className="mt-2 text-xs">{detail}</p></li>)}</ol>
    </article>)}</>}
  </section>;
}
