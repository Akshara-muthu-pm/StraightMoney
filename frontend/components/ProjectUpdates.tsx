"use client";
/* eslint-disable @next/next/no-img-element -- Evidence is served by the API at runtime. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { invoiceStages } from "@/lib/presentation";

export default function ProjectUpdates({ campaignId }: { campaignId: number }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    api.getInvoices(campaignId).then((items) => { if (active) { setInvoices(items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))); setState("ready"); } }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [campaignId]);
  return <section id="updates" className="section-space" aria-labelledby="updates-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Follow the little milestones</p><h2 id="updates-title" className="display-heading mt-3 text-4xl">The story as it unfolds.</h2></div><Link href={`/ledger/${campaignId}`} className="text-sm font-semibold text-brand-800 underline underline-offset-4">View the public ledger</Link></div>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Progress from submitted invoices and delivery evidence. A photo records a submission; it does not by itself confirm approval or payment.</p>
    {state === "loading" && <p role="status" className="mt-5">Loading project updates...</p>}
    {state === "error" && <p role="status" className="surface-card mt-5 p-6">Project updates are unavailable right now. Try the public ledger again later.</p>}
    {state === "ready" && invoices.length === 0 && <p className="surface-card mt-5 p-6 text-sm text-slate-600">No delivery updates have been submitted yet. Progress and evidence will appear as the work moves forward.</p>}
    <div className="mt-6 grid gap-5 md:grid-cols-2">{invoices.slice(0, 4).map((invoice) => {
      const url = api.assetUrl(invoice.evidence_path);
      const stages = invoiceStages(invoice);
      return <article key={invoice.id} className="surface-card overflow-hidden">{url && /\.(png|jpe?g|webp)$/i.test(invoice.evidence_path ?? "") && <img src={url} alt={`Submitted delivery evidence for ${invoice.budget_line_name ?? invoice.invoice_number}`} loading="lazy" width={640} height={360} className="h-56 w-full object-cover" />}<div className="p-6"><p className="eyebrow">{USE_MOCKS ? "Sample progress record" : "Vendor progress record"}</p><h3 className="mt-3 text-xl font-semibold">{invoice.budget_line_name ?? invoice.invoice_number}</h3><p className="mt-2 text-xs text-slate-500">{new Date(invoice.created_at).toLocaleDateString()} / {invoice.vendor_name ?? "Vendor"}</p><p className="mt-3 text-sm leading-7 text-slate-600">{invoice.description ?? "Invoice submitted for review."}</p><dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm"><div><dt className="text-xs text-slate-500">Review</dt><dd className="font-semibold">{stages.review}</dd></div><div><dt className="text-xs text-slate-500">Payment</dt><dd className="font-semibold">{stages.payment}</dd></div></dl>{url ? <a href={url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-semibold text-brand-800 underline">View submitted evidence (new tab)</a> : <p className="mt-5 text-xs text-slate-500">{USE_MOCKS ? "Mock record only. No delivery photo supplied." : "No delivery photo available."}</p>}</div></article>;
    })}</div>
  </section>;
}
