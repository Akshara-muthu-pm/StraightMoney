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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          Select Project
          <select
            disabled={loading || campaigns.length === 0}
            value={selectedId ?? ""}
            onChange={(event) => { setSelectedId(Number(event.target.value)); setCampaign(null); setVendorId(null); setError(""); setLoading(true); }}
            className="mt-1.5 block max-w-full rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2.5 text-sm font-bold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
          >
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        {role === "Vendor" && campaign && (
          <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Vendor assignment
            <select
              value={vendor?.id ?? ""}
              onChange={(event) => setVendorId(Number(event.target.value))}
              className="mt-1.5 block rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2.5 text-sm font-bold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
            >
              {campaign.vendors.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-secondary text-xs" disabled={loading} onClick={reload}>
          Refresh records
        </button>
        {role === "Organizer" && (
          <button
            type="button"
            className="button-primary text-xs"
            aria-expanded={creating}
            aria-controls="create-campaign"
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? "Back to project" : "+ Create campaign"}
          </button>
        )}
      </div>
    </div>
    {notice && <p role="status" className="mb-5 rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 text-xs font-bold text-[#003087] backdrop-blur-md">{notice}</p>}
    {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900">{error}</p>}
    {loading && <p role="status" className="text-xs text-slate-500">Loading project work...</p>}
    {role === "Organizer" && creating ? (
      <section id="create-campaign">
        <OrganizerForm
          campaign={campaign ?? undefined}
          onCreated={(id) => { setSelectedId(id); setCreating(false); setNotice(`Campaign ${id} created. Budget and vendor assignments are saved.`); reload(); }}
        />
      </section>
    ) : !loading && !error && campaign && (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [role === "Organizer" ? "Available campaign funds" : "Assigned budget", money(role === "Organizer" ? campaign.pool_balance : lines.reduce((sum, line) => sum + line.budgeted_amount, 0), campaign.currency), "#0070BA"],
            ["Confirmed paid", money(lines.reduce((sum, line) => sum + line.paid_amount, 0), campaign.currency), "#10B981"],
            ["Unpaid on submitted invoices", money(rows.filter((item) => !["REJECTED", "VERIFIER_REJECTED"].includes(item.status)).reduce((sum, item) => sum + item.remaining_amount, 0), campaign.currency), "#F59E0B"]
          ].map(([label, value, accentColor]) => (
            <div className="liquid-glass p-5" key={label}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
              </div>
              <p className="mt-3 text-3xl font-black text-[#001435]">{value}</p>
            </div>
          ))}
        </div>
        
        <section className="liquid-glass mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#001435]">{campaign.title}</h2>
            <div className="flex gap-4 text-xs font-bold text-[#003087]">
              <Link href={`/campaigns/${campaign.id}`} className="underline hover:text-[#0070BA]">Public story &rarr;</Link>
              <Link href={`/ledger/${campaign.id}`} className="underline hover:text-[#0070BA]">Public ledger &rarr;</Link>
            </div>
          </div>
          {role === "Organizer" && (
            <div className="mt-6 max-w-xl">
              <ProgressBar current={totalFunded(campaign)} goal={campaign.goal_amount} />
              <p className="mt-3 text-xs font-medium text-slate-500">{money(totalFunded(campaign), campaign.currency)} funded of {money(campaign.goal_amount, campaign.currency)}. Includes completed payouts.</p>
            </div>
          )}
          <h3 className="mt-6 text-sm font-extrabold text-[#001435]">{role === "Organizer" ? "Budget and vendor assignments" : "Assigned work"}</h3>
          <div className="mt-3 divide-y divide-slate-200/70">
            {lines.map((line) => (
              <div key={line.id} className="flex flex-wrap justify-between gap-3 py-3.5 text-xs">
                <div>
                  <strong className="text-sm font-bold text-[#001435]">{line.name}</strong>
                  <p className="mt-0.5 text-slate-500">{line.vendor_name ?? "Vendor pending"}</p>
                </div>
                <div className="text-right">
                  <strong className="text-sm font-black text-[#003087]">{money(line.budgeted_amount, campaign.currency)} budget</strong>
                  <p className="mt-0.5 font-medium text-slate-500">{money(line.paid_amount, campaign.currency)} paid</p>
                </div>
              </div>
            ))}
          </div>
          {lines.length === 0 && <p className="mt-4 text-xs text-slate-500">No work assigned to this vendor.</p>}
        </section>

        <section className="mt-8" aria-labelledby="tracking-title">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA]" />
            <h2 id="tracking-title" className="text-2xl font-extrabold tracking-tight text-[#001435]">
              {role === "Organizer" ? "Delivery and invoice progress" : "Review and payment tracker"}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">Approval is a review decision. Payment may still await funds or PayPal confirmation.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {rows.map((invoice) => (
              <article key={invoice.id} className="liquid-glass p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-extrabold text-[#001435]">{invoice.invoice_number} / {invoice.budget_line_name}</h3>
                  <span className="text-xs font-bold text-[#003087]">{money(invoice.amount, invoice.currency)}</span>
                </div>
                <p className="mb-4 mt-1 text-xs text-slate-500">{invoice.vendor_name}</p>
                <InvoiceStages invoice={invoice} />
                <p className="mt-3 text-[11px] font-semibold text-slate-500">Recorded status: <span className="font-bold text-[#001435]">{invoice.status.replaceAll("_", " ").toLowerCase()}</span></p>
                {api.assetUrl(invoice.evidence_path) && (
                  <a href={api.assetUrl(invoice.evidence_path)!} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-[#003087] underline hover:text-[#0070BA]">
                    Delivery evidence (new tab) &rarr;
                  </a>
                )}
              </article>
            ))}
          </div>
          {rows.length === 0 && <p className="liquid-glass mt-5 p-6 text-xs text-slate-500">No invoices submitted for this work yet.</p>}
        </section>
        
        {role === "Vendor" && lines.length > 0 && (
          <section className="mt-10" aria-labelledby="upload-title">
            <h2 id="upload-title" className="mb-6 text-2xl font-extrabold tracking-tight text-[#001435]">Ready to share your work?</h2>
            <VendorForm key={`${campaign.id}-${vendor?.id}-${revision}`} campaign={{ ...campaign, budget_lines: lines }} onSubmitted={() => { setNotice("Invoice submitted. Follow its review and payment in the tracker above."); reload(); }} />
          </section>
        )}
        {USE_MOCKS && <p className="mt-6 text-[11px] text-slate-500">Sample records. Preview actions do not save changes or send money.</p>}
      </>
    )}
    {!loading && !error && campaigns.length === 0 && !creating && <p className="liquid-glass p-6 text-xs text-slate-500">No campaigns yet. {role === "Organizer" ? "Create your first campaign to define its budget and vendors." : "Assigned work will appear after an organizer creates a campaign and assigns a vendor."}</p>}
  </>;
}
