"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign, CampaignSummary, Invoice } from "@/lib/types";
import { money, totalFunded } from "@/lib/presentation";
import DashboardShell from "./DashboardShell";
import OrganizerForm from "./OrganizerForm";
import VendorForm from "./VendorForm";
import InvoiceStages from "./InvoiceStages";
import ProgressBar from "./ProgressBar";

export default function ProjectWorkspace({ role }: { role: "Organizer" | "Vendor" }) {
  return <DashboardShell role={role} title={role === "Organizer" ? "Bring the next chapter to life." : "Your work. Its next step."} description={role === "Organizer" ? "Monitor campaign funding and delivery, or create a new project with a budget and assigned vendors." : "Open an assignment, submit its invoice and delivery proof, and track review and payment separately."} steps={role === "Organizer" ? ["Create campaign", "Define budget", "Assign vendors", "Monitor delivery"] : ["Open work", "Upload invoice & proof", "Track review", "Track payment"]}><WorkspaceContent role={role} /></DashboardShell>;
}

function WorkspaceContent({ role }: { role: "Organizer" | "Vendor" }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api.listCampaigns().then((items) => {
      if (!active) return;
      setCampaigns(items);
      setSelectedId((current) => current ?? items[0]?.id ?? null);
      if (items.length === 0) setLoading(false);
    }).catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : "Could not load projects."); setLoading(false); } });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    Promise.all([api.getCampaign(selectedId), api.getInvoices(selectedId)]).then(([project, rows]) => {
      if (active) { setCampaign(project); setInvoices(rows); setError(""); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load project work."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, revision]);
  const vendor = campaign?.vendors.find((item) => item.id === vendorId) ?? campaign?.vendors[0];
  const lines = campaign?.budget_lines.filter((line) => role === "Organizer" || (vendor && line.vendor_id === vendor.id)) ?? [];
  const rows = invoices.filter((item) => role === "Organizer" || (vendor && item.vendor_id === vendor.id));
  const reload = () => { setLoading(true); setError(""); setRevision((value) => value + 1); };
  return <>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-semibold">Project<select disabled={loading || campaigns.length === 0} value={selectedId ?? ""} onChange={(event) => { setSelectedId(Number(event.target.value)); setCampaign(null); setVendorId(null); setError(""); setLoading(true); }} className="mt-2 block max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2">{campaigns.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{role === "Vendor" && campaign && <label className="text-sm font-semibold">Vendor assignment<select value={vendor?.id ?? ""} onChange={(event) => setVendorId(Number(event.target.value))} className="mt-2 block rounded-xl border border-slate-300 bg-white px-3 py-2">{campaign.vendors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div><div className="flex flex-wrap gap-3"><button type="button" className="button-secondary" disabled={loading} onClick={reload}>Refresh records</button>{role === "Organizer" && <button type="button" className="button-primary" aria-expanded={creating} aria-controls="create-campaign" onClick={() => setCreating((value) => !value)}>{creating ? "Back to project" : "+ Create campaign"}</button>}</div></div>
    {notice && <p role="status" className="mb-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">{notice}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</p>}
    {loading && <p role="status">Loading project work...</p>}
    {role === "Organizer" && creating ? <section id="create-campaign"><OrganizerForm campaign={campaign ?? undefined} onCreated={(id) => { setSelectedId(id); setCreating(false); setNotice(`Campaign ${id} created. Budget and vendor assignments are saved.`); reload(); }} /></section> : !loading && !error && campaign && <>
      <div className="grid gap-4 sm:grid-cols-3">{[[role === "Organizer" ? "Available campaign funds" : "Assigned budget", money(role === "Organizer" ? campaign.pool_balance : lines.reduce((sum, line) => sum + line.budgeted_amount, 0), campaign.currency)], ["Confirmed paid", money(lines.reduce((sum, line) => sum + line.paid_amount, 0), campaign.currency)], ["Unpaid on submitted invoices", money(rows.filter((item) => !["REJECTED", "VERIFIER_REJECTED"].includes(item.status)).reduce((sum, item) => sum + item.remaining_amount, 0), campaign.currency)]].map(([label, value]) => <div className="surface-card p-5" key={label}><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>)}</div>
      <section className="surface-card mt-6 p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="display-heading text-3xl">{campaign.title}</h2><div className="flex gap-4 text-sm font-semibold text-brand-800"><Link href={`/campaigns/${campaign.id}`} className="underline">Public story</Link><Link href={`/ledger/${campaign.id}`} className="underline">Ledger</Link></div></div>{role === "Organizer" && <div className="mt-6 max-w-xl"><ProgressBar current={totalFunded(campaign)} goal={campaign.goal_amount} /><p className="mt-3 text-xs text-slate-600">{money(totalFunded(campaign), campaign.currency)} funded of {money(campaign.goal_amount, campaign.currency)}. Includes completed payouts.</p></div>}<h3 className="mt-6 font-bold">{role === "Organizer" ? "Budget and vendor assignments" : "Assigned work"}</h3><div className="mt-3 divide-y divide-slate-200">{lines.map((line) => <div key={line.id} className="flex flex-wrap justify-between gap-3 py-4 text-sm"><div><strong>{line.name}</strong><p className="mt-1 text-slate-600">{line.vendor_name ?? "Vendor pending"}</p></div><div className="text-right"><strong>{money(line.budgeted_amount, campaign.currency)} budget</strong><p className="mt-1 text-slate-600">{money(line.paid_amount, campaign.currency)} paid</p></div></div>)}</div>{lines.length === 0 && <p className="mt-4 text-sm text-slate-600">No work assigned to this vendor.</p>}</section>
      <section className="mt-8" aria-labelledby="tracking-title"><h2 id="tracking-title" className="display-heading text-3xl">{role === "Organizer" ? "Delivery and invoice progress" : "Review and payment tracker"}</h2><p className="mt-3 text-sm leading-7 text-slate-600">Approval is a review decision. Payment may still await funds or PayPal confirmation.</p><div className="mt-5 grid gap-5 lg:grid-cols-2">{rows.map((invoice) => <article key={invoice.id} className="surface-card p-5"><h3 className="font-bold">{invoice.invoice_number} / {invoice.budget_line_name}</h3><p className="mb-4 mt-2 text-sm text-slate-600">{invoice.vendor_name} · {money(invoice.amount, invoice.currency)}</p><InvoiceStages invoice={invoice} /><p className="mt-3 text-xs text-slate-500">Recorded status: {invoice.status.replaceAll("_", " ").toLowerCase()}</p>{api.assetUrl(invoice.evidence_path) && <a href={api.assetUrl(invoice.evidence_path)!} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-brand-800 underline">Delivery evidence (new tab)</a>}</article>)}</div>{rows.length === 0 && <p className="surface-card mt-5 p-6 text-sm text-slate-600">No invoices submitted for this work yet.</p>}</section>
      {role === "Vendor" && lines.length > 0 && <section className="mt-10" aria-labelledby="upload-title"><h2 id="upload-title" className="display-heading mb-6 text-3xl">Ready to share your work?</h2><VendorForm key={`${campaign.id}-${vendor?.id}-${revision}`} campaign={{ ...campaign, budget_lines: lines }} onSubmitted={() => { setNotice("Invoice submitted. Follow its review and payment in the tracker above."); reload(); }} /></section>}
      {USE_MOCKS && <p className="mt-6 text-xs text-slate-500">Sample records. Preview actions do not save changes or send money.</p>}
    </>}
    {!loading && !error && campaigns.length === 0 && !creating && <p className="surface-card p-6">No campaigns yet. {role === "Organizer" ? "Create your first campaign to define its budget and vendors." : "Assigned work will appear after an organizer creates a campaign and assigns a vendor."}</p>}
  </>;
}
