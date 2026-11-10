"use client";

import PaymentModelNotice from "./PaymentModelNotice";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign, CampaignSummary, Donation, Invoice } from "@/lib/types";
import { budgetLineStatus, money, totalFunded, type BudgetLineStatus } from "@/lib/presentation";
import DashboardShell from "./DashboardShell";
import ScreeningReport from "./ScreeningReport";
import AmendmentPanel from "./AmendmentPanel";
import OrganizerForm from "./OrganizerForm";
import VendorForm from "./VendorForm";
import InvoiceStages from "./InvoiceStages";
import ProgressBar from "./ProgressBar";
import DeliveryCloseoutPanel from "./DeliveryCloseoutPanel";

const lineBadge: Record<BudgetLineStatus, { label: string; icon: string; className: string }> = {
  paid: { label: "Payment successful", icon: "✅", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  approved: { label: "Approved — awaiting funds/payment", icon: "✓", className: "border-blue-200 bg-blue-50 text-blue-950" },
  "payment-pending": { label: "Approved — payment pending", icon: "⏳", className: "border-amber-200 bg-amber-50 text-amber-950" },
  "partially-paid": { label: "Partially paid", icon: "◐", className: "border-blue-200 bg-blue-50 text-blue-950" },
  "payment-failed": { label: "Approved — payment failed", icon: "!", className: "border-red-200 bg-red-50 text-red-950" },
  "evidence-required": { label: "More evidence required", icon: "!", className: "border-amber-200 bg-amber-50 text-amber-950" },
  escalated: { label: "Escalated", icon: "!", className: "border-red-200 bg-red-50 text-red-950" },
  simulated: { label: "Simulated — no funds sent", icon: "◌", className: "border-amber-200 bg-amber-50 text-amber-950" },
  rejected: { label: "Rejected", icon: "❌", className: "border-red-200 bg-red-50 text-red-900" },
  "awaiting-vendor": { label: "Awaiting vendor", icon: "⏳", className: "border-amber-200 bg-amber-50 text-amber-900" },
  "in-review": { label: "In review", icon: "🔵", className: "border-blue-200 bg-blue-50 text-[#003087]" },
};

export default function ProjectWorkspace({ role }: { role: "Organizer" | "Vendor" }) {
  return <DashboardShell role={role} title={role === "Organizer" ? "Bring the next chapter to life." : "Your work. Its next step."} description={role === "Organizer" ? "Monitor campaign funding and delivery, or create a new project with a budget and assigned vendors." : "Open an assignment, submit its invoice and delivery proof, and track review and payment separately."} steps={role === "Organizer" ? ["Create campaign", "Define budget", "Assign vendors", "Monitor delivery"] : ["Open work", "Upload invoice & proof", "Track review", "Track payment"]}><WorkspaceContent role={role} /></DashboardShell>;
}

function WorkspaceContent({ role }: { role: "Organizer" | "Vendor" }) {
  const [correction, setCorrection] = useState<Invoice | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [vendorId, setVendorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creationLimit, setCreationLimit] = useState<{ limit: number; count: number; remaining: number } | null>(null);
  useEffect(() => {
    if (role === "Organizer") api.campaignCreationLimit().then(setCreationLimit).catch(() => setCreationLimit(null));
  }, [role, revision]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [assignedVendorIds, setAssignedVendorIds] = useState<number[]>([]);
  const [invite, setInvite] = useState<{ email: string; invite_token: string } | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Array<{
    invite_id: number;
    vendor_id: number;
    vendor_name: string;
    campaign_id: number;
    campaign_title: string;
    organizer_name: string;
    expires_at: string;
  }>>([]);
  const [activePromptInviteId, setActivePromptInviteId] = useState<number | null>(null);
  const [promptKey, setPromptKey] = useState("");
  const [claimId, setClaimId] = useState("1");
  const [setupKey, setSetupKey] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api.myCampaigns(),
      role === "Vendor" ? api.myVendors() : Promise.resolve([]),
      role === "Vendor" ? api.myPendingInvites().catch(() => []) : Promise.resolve([]),
    ]).then(([items, assignments, invites]) => {
      if (!active) return;
      setCampaigns(items);
      setAssignedVendorIds(assignments.map((item) => item.id));
      setPendingInvites(invites as typeof pendingInvites);
      setSelectedId((current) => current ?? items[0]?.id ?? null);
      if (items.length === 0) setLoading(false);
    }).catch((cause: unknown) => { if (active) { setError(cause instanceof Error ? cause.message : "Could not load projects."); setLoading(false); } });
    return () => { active = false; };
  }, [revision, role]);
  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    Promise.all([api.getCampaign(selectedId), api.getInvoices(selectedId), role === "Organizer" ? api.organizerDonations(selectedId) : Promise.resolve([])]).then(([project, rows, gifts]) => {
      if (active) { setCampaign(project); setInvoices(rows); setDonations(gifts); setError(""); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load project work."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId, revision, role]);
  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      Promise.all([api.getCampaign(selectedId), api.getInvoices(selectedId)]).then(([project, rows]) => {
        if (active) {setCampaign(project); setInvoices(rows); setSyncError("");}
      }).catch(() => {if (active) setSyncError("Latest review/payment status could not refresh. Use Refresh records to try again.");});
    };
    const timer = window.setInterval(sync, 10000);
    document.addEventListener("visibilitychange", sync);
    return () => {active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", sync);};
  }, [selectedId]);
  const assignedVendors = campaign?.vendors.filter((item) => assignedVendorIds.includes(item.id)) ?? [];
  const vendor = assignedVendors.find((item) => item.id === vendorId) ?? assignedVendors[0];
  const lines = campaign?.budget_lines.filter((line) => role === "Organizer" || (vendor && line.vendor_id === vendor.id)) ?? [];
  const rows = invoices.filter((item) => role === "Organizer" || (vendor && item.vendor_id === vendor.id));
  const reload = () => { setLoading(true); setError(""); setRevision((value) => value + 1); };
  return <>
    {role === "Vendor" && pendingInvites.length > 0 && (
      <div className="mb-6 space-y-3">
        {pendingInvites.map((inv) => (
          <div key={inv.invite_id} className="rounded-2xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-5 shadow-xs dark:border-blue-700 dark:from-slate-900 dark:to-blue-950/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-[#003087] dark:bg-blue-950 dark:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                  Campaign Invitation Waiting
                </span>
                <h3 className="mt-1.5 text-base font-extrabold text-[#001435] dark:text-white">
                  {inv.campaign_title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Assigned Vendor Role: <strong>{inv.vendor_name}</strong> &middot; Organizer: <strong>{inv.organizer_name}</strong>
                </p>
              </div>

              <div>
                {activePromptInviteId === inv.invite_id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      api.acceptVendorInvite(promptKey.trim())
                        .then(() => {
                          setPromptKey("");
                          setActivePromptInviteId(null);
                          setNotice(`Accepted invitation for ${inv.campaign_title}. Your workspace is ready!`);
                          reload();
                        })
                        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not accept invitation. Please verify your invitation key."));
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="text"
                      required
                      minLength={32}
                      placeholder="Paste 32+ char key from organizer"
                      value={promptKey}
                      onChange={(e) => setPromptKey(e.target.value)}
                      className="rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-xs text-[#001435] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0070BA] dark:bg-slate-800 dark:text-white min-w-[260px]"
                    />
                    <button type="submit" className="button-primary text-xs">Confirm Key</button>
                    <button
                      type="button"
                      onClick={() => { setActivePromptInviteId(null); setPromptKey(""); }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setActivePromptInviteId(inv.invite_id); setPromptKey(""); }}
                    className="button-primary text-xs"
                  >
                    Accept Invitation
                  </button>
                )}
              </div>
            </div>
            {activePromptInviteId === inv.invite_id && (
              <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                🔑 Enter the invitation key sent to you by organizer <strong>{inv.organizer_name}</strong> to unlock this assignment.
              </p>
            )}
          </div>
        ))}
      </div>
    )}

    {role === "Vendor" && campaigns.length === 0 && pendingInvites.length === 0 && !loading && (
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl dark:bg-blue-950">
          📦
        </div>
        <h3 className="mt-3 text-base font-bold text-[#001435] dark:text-white">No active campaign assignments yet</h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
          When an organizer assigns your email to a campaign and sends an invitation, it will appear right here above. If you already have an invitation key, you can enter it below.
        </p>
      </div>
    )}

    {role === "Vendor" && (
      <form className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60" onSubmit={(event) => {
        event.preventDefault();
        api.acceptVendorInvite(inviteInput.trim()).then(() => { setInviteInput(""); setNotice("Assignment added."); reload(); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not accept invitation."));
      }}>
        <label className="min-w-52 flex-1 text-xs font-bold text-[#003087] dark:text-sky-300">Have an invitation key? Enter it here:
          <input required value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} placeholder="32-character invitation key" className="mt-1 block w-full rounded-lg border border-blue-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </label>
        <button className="button-secondary text-xs">Accept key</button>
      </form>
    )}
    {role === "Organizer" && campaigns.length === 0 && !loading && <form className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4" onSubmit={(event) => {
      event.preventDefault();
      api.claimCampaign(Number(claimId), setupKey).then(() => { setSetupKey(""); setNotice("Existing campaign assigned to your account."); reload(); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not claim campaign."));
    }}>
      <label className="text-xs font-bold text-[#003087]">Existing campaign ID<input required type="number" min="1" value={claimId} onChange={(event) => setClaimId(event.target.value)} className="mt-1 block w-28 rounded-lg border border-blue-200 bg-white p-2 text-sm" /></label>
      <label className="min-w-52 flex-1 text-xs font-bold text-[#003087]">Setup key<input required type="password" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white p-2 text-sm" /></label>
      <button className="button-secondary text-xs">Claim existing campaign</button>
    </form>}
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
              {assignedVendors.map((item) => (
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
            disabled={loading || (!creating && (!creationLimit || creationLimit.remaining === 0))}
            aria-expanded={creating}
            aria-controls="create-campaign"
            onClick={() => setCreating((value) => !value)}
          >
            {creating ? "Back to project" : "+ Create campaign"}
          </button>
        )}
      </div>
    </div>
    {role === "Organizer" && creationLimit && <p role="status" className="mb-4 text-sm text-slate-700 dark:text-slate-200">
      {creationLimit.count} / {creationLimit.limit} campaigns created. {creationLimit.remaining === 0 ? "Campaign creation limit reached." : `${creationLimit.remaining} remaining.`}
    </p>}
    {syncError && <p role="status" className="mb-4 rounded-xl border border-amber-300 p-3 text-sm">{syncError}</p>}
    <PaymentModelNotice />
    {notice && <p role="status" className="mb-5 rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 text-xs font-bold text-[#003087] backdrop-blur-md">{notice}</p>}
    {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900">{error}</p>}
    {loading && <p role="status" className="text-xs text-slate-500">Loading project work...</p>}
    {role === "Organizer" && creating && creationLimit && creationLimit.remaining > 0 ? (
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
              <p className="mt-3 text-3xl font-black text-[#001435] tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        
        <section className="liquid-glass mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#001435]">{campaign.title}</h2>
            <div className="flex gap-4 text-xs font-bold text-[#003087]">
              <Link href={`/campaigns/${campaign.id}`} className="underline hover:text-[#0070BA]">Public story &rarr;</Link>
              <Link href={`/ledger/${campaign.id}`} className="underline hover:text-[#0070BA]">Public ledger &rarr;</Link>
              {!USE_MOCKS && <a href={api.campaignReportUrl(campaign.id)} className="underline hover:text-[#0070BA]">Download report (.csv)</a>}
            </div>
          </div>
          {role === "Organizer" && (
            <div className="mt-6 max-w-xl">
              <ProgressBar current={totalFunded(campaign)} goal={campaign.goal_amount} />
              <p className="mt-3 text-xs font-medium text-slate-500">{money(totalFunded(campaign), campaign.currency)} funded of {money(campaign.goal_amount, campaign.currency)}. Includes completed payouts.</p>
            </div>
          )}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-bold">Beneficiary</dt><dd>{campaign.beneficiary || "Not specified"}</dd></div><div><dt className="font-bold">Expected deliverables</dt><dd>{campaign.expected_deliverables || "See assigned budget lines; ask the organizer to clarify."}</dd></div></dl>
          <h3 className="mt-6 text-sm font-extrabold text-[#001435]">{role === "Organizer" ? "Budget and vendor assignments" : "Assigned work"}</h3>
          <div className="mt-3 divide-y divide-slate-200/70">
            {lines.map((line) => {
              const badge = lineBadge[budgetLineStatus(line.id, invoices)];
              return (
                <div key={line.id} className="flex flex-wrap justify-between gap-3 py-3.5 text-xs">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-bold text-[#001435]">{line.name}</strong>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}>
                        <span aria-hidden="true">{badge.icon}</span>{badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-slate-500">{line.vendor_name ?? "Vendor pending"}</p>
                  {role === "Organizer" && line.vendor_id !== null && (
                    <button type="button" className="mt-1 font-bold text-[#003087] underline" onClick={() => {
                      api.inviteVendor(campaign.id, line.vendor_id!).then(setInvite).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Could not create invitation."));
                    }}>Create vendor invitation</button>
                  )}
                  </div>
                  <div className="text-right">
                    <strong className="text-sm font-black text-[#003087] tabular-nums">{money(line.budgeted_amount, campaign.currency)} budget</strong>
                    <p className="mt-0.5 font-medium text-slate-500 tabular-nums">{money(line.paid_amount, campaign.currency)} paid</p>
                  </div>
                </div>
              );
            })}
          </div>
          {lines.length === 0 && <p className="mt-4 text-xs text-slate-500">No work assigned to this vendor.</p>}
          {invite && <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-[#001435]">
            Share this one-time invitation privately with <strong>{invite.email}</strong>. It expires in 7 days.
            <code className="mt-2 block break-all rounded bg-white p-2 font-mono select-all">{invite.invite_token}</code>
          </div>}
        </section>

        {role === "Organizer" && <AmendmentPanel campaignId={campaign.id} campaign={campaign} mode="organizer" onChanged={reload} />}
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
                  <span className="text-xs font-bold text-[#003087] tabular-nums">{money(invoice.amount, invoice.currency)}</span>
                </div>
                <p className="mb-4 mt-1 text-xs text-slate-500">{invoice.vendor_name}</p>
                <InvoiceStages invoice={invoice} />
                <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">Screening, decisions and corrections</summary><ScreeningReport invoice={invoice} /></details>
                {role === "Vendor" && ["MORE_EVIDENCE_REQUIRED", "REJECTED", "NEEDS_REVIEW"].includes(invoice.status) && <button className="button-secondary mt-3 text-xs" onClick={() => { setCorrection(invoice); document.getElementById("upload-title")?.scrollIntoView({behavior: "smooth"}); }}>Correct and resubmit this claim</button>}
                <DeliveryCloseoutPanel invoice={invoice} role={role} onSaved={() => { setNotice("Delivery closeout saved."); reload(); }} />
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

        {role === "Organizer" && <section className="liquid-glass mt-8 p-6" aria-labelledby="campaign-closeout-heading">
          <h2 id="campaign-closeout-heading" className="text-xl font-extrabold text-[#001435]">Campaign cancellation and refunds</h2>
          {campaign.status === "active" ? <>
            <p className="mt-2 text-xs text-slate-600">Cancelling stops new donations and future payouts. Captured PayPal donations must be refunded separately; completed payouts remain recorded.</p>
            <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => {
              event.preventDefault(); setPaymentBusy(true); setError("");
              api.cancelCampaign(campaign.id, cancelReason).then(() => { setCancelReason(""); setNotice("Campaign cancelled. Review captured donations for refunds."); reload(); })
                .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not cancel campaign."))
                .finally(() => setPaymentBusy(false));
            }}>
              <label className="min-w-64 flex-1 text-xs font-bold">Reason for cancellation
                <input required minLength={5} maxLength={2000} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
              </label>
              <button disabled={paymentBusy} className="button-secondary text-xs">Cancel campaign</button>
            </form>
          </> : <>
            <p className="mt-2 text-xs text-slate-600">{campaign.cancellation_reason ? `Cancelled: ${campaign.cancellation_reason}` : "Campaign is closed."} Refunds and disputes appear in the public ledger and reduce available funds when confirmed.</p>
            <div className="mt-4 space-y-2">
              {donations.filter((donation) => donation.source === "paypal" && donation.status === "captured").map((donation) => <div key={donation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs">
                <span><strong>{donation.donor_name}</strong> · {money(donation.amount, donation.currency)} captured · {money(donation.unavailable_amount ?? 0, donation.currency)} refunded or held</span>
                <button type="button" disabled={paymentBusy || donation.refund_processed} className="button-secondary text-xs" onClick={() => {
                  setPaymentBusy(true); setError("");
                  api.refundDonation(donation.id).then(() => { setNotice("Refund requested. The ledger will update when PayPal confirms it."); reload(); })
                    .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not request refund."))
                    .finally(() => setPaymentBusy(false));
                }}>{donation.refund_processed ? "Refund recorded" : donation.refund_requested ? "Check refund" : "Refund through PayPal"}</button>
              </div>)}
              {donations.length === 0 && <p className="text-xs text-slate-500">No donations to refund.</p>}
            </div>
          </>}
        </section>}
        
        {role === "Vendor" && lines.length > 0 && (
          <section className="mt-10" aria-labelledby="upload-title">
            <h2 id="upload-title" className="mb-6 text-2xl font-extrabold tracking-tight text-[#001435]">Ready to share your work?</h2>
            {correction && <button className="button-secondary mb-3 text-xs" onClick={() => setCorrection(null)}>Cancel correction</button>}
            <VendorForm correction={correction?.campaign_id === campaign.id && correction.vendor_id === vendor?.id ? correction : null} key={`${campaign.id}-${vendor?.id}-${revision}-${correction?.id ?? "new"}`} campaign={{ ...campaign, budget_lines: lines }} onSubmitted={() => { setCorrection(null); setNotice("Invoice submitted. Follow its review and payment in the tracker above."); reload(); }} />
          </section>
        )}
        {USE_MOCKS && <p className="mt-6 text-[11px] text-slate-500">Sample records. Preview actions do not save changes or send money.</p>}
      </>
    )}
    {!loading && !error && campaigns.length === 0 && !creating && <p className="liquid-glass p-6 text-xs text-slate-500">No campaigns yet. {role === "Organizer" ? "Create your first campaign to define its budget and vendors." : "Assigned work will appear after an organizer creates a campaign and assigns a vendor."}</p>}
  </>;
}
