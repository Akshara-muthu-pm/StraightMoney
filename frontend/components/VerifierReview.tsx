"use client";
/* eslint-disable @next/next/no-img-element -- The API serves user-uploaded evidence at runtime. */

import PaymentModelNotice from "./PaymentModelNotice";
import { useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import ScreeningReport from "./ScreeningReport";
import StatusBadge from "./StatusBadge";
import InvoiceStages from "./InvoiceStages";
import { useAccount } from "@/lib/account-session";

export default function VerifierReview({ invoice, onChanged }: { invoice: Invoice; onChanged: (updated: Invoice) => void }) {
  const account = useAccount();
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const payoutCountryRestricted = /PAYOUT_NOT_AVAILABLE|country that is not allowed to send this payout|sandbox sender account.s country/i.test(invoice.ai_summary ?? "");
  const evidenceUrl = api.assetUrl(invoice.evidence_path);
  const invoiceUrl = api.assetUrl(invoice.raw_file_path);
  const isImage = (path: string | null) => !!path && /\.(png|jpe?g|webp)$/i.test(path);
  const decide = async (action: "approve" | "reject" | "retry" | "request-evidence" | "escalate" | "reopen") => {
    setPending(true); setError(""); setMessage("");
    const body = { verifier_name: account?.name || "Verifier", note: note.trim() || undefined, recipient_confirmed: recipientConfirmed, confirmation_reference: confirmation.trim() };
    try {
      const updated = action === "request-evidence" || action === "escalate" || action === "reopen" ? await api.reviewAction(invoice.id, action, note.trim()) : action === "approve" ? await api.approveInvoice(invoice.id, body) : action === "reject" ? await api.rejectInvoice(invoice.id, body) : await api.retryInvoice(invoice.id, body);
      setMessage(USE_MOCKS ? `Demo ${action} selected. No request was sent.` : `Invoice is now ${updated.status}.`);
      if (!USE_MOCKS) onChanged(updated);
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not ${action} invoice.`); }
    finally { setPending(false); }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
      <div className="space-y-6">
        <section className="liquid-glass p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087]">
                Invoice {invoice.invoice_number}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435]">
                {invoice.budget_line_name ?? "Budget line unavailable"}
              </h2>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="mt-6">
            <InvoiceStages invoice={invoice} />
          </div>
          <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-950 dark:bg-blue-950 dark:text-blue-100"><strong>{invoice.campaign_requirements?.title}</strong><p>Beneficiary: {invoice.campaign_requirements?.beneficiary || "Not specified — clarify before approving."}</p><p>Expected delivery: {invoice.campaign_requirements?.expected_deliverables || "Review the campaign budget and confirm expectations with the recipient."}</p></div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Vendor", invoice.vendor_name ?? "Unknown"],
              ["Invoice amount", `$${invoice.amount.toFixed(2)} ${invoice.currency}`],
              ["Paid", `$${invoice.paid_amount.toFixed(2)}`],
              ["Still owed", `$${invoice.remaining_amount.toFixed(2)}`],
              ["Payout email", invoice.payout_email],
              ["Submitted", new Date(invoice.created_at).toLocaleDateString()]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200/60 bg-white/70 p-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-800/60">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-300">{label}</dt>
                <dd className="mt-1 text-sm font-bold text-[#001435] dark:text-white tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 border-t border-slate-200/60 pt-4 text-xs leading-relaxed text-slate-600">
            {invoice.description ?? "No description extracted."}
          </p>
        </section>

        <section className="liquid-glass space-y-3 p-5 text-sm text-slate-800 dark:text-slate-100"><h3 className="font-extrabold">{invoice.review_guidance?.label || "Detailed human review"}</h3><ul className="list-disc pl-5">{invoice.review_guidance?.reasons.map((reason)=><li key={reason}>{reason}</li>)}</ul><p className="text-xs">{invoice.review_guidance?.basis || "Independent confirmation is required for every claim."}</p>{invoice.review_guidance?.depth === "standard" && <p className="text-xs font-semibold">Quick confirmation: compare the invoice, inspect the proof, confirm receipt independently, then record your decision.</p>}</section>
        {invoice.review_guidance?.depth === "standard" ? <details><summary className="cursor-pointer text-sm font-bold">Inspect the full screening report and history</summary><ScreeningReport invoice={invoice} /></details> : <ScreeningReport invoice={invoice} />}
      </div>

      <aside className="space-y-6">
        <section className="liquid-glass p-6 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight text-[#001435]">Delivery Evidence</h2>
          {evidenceUrl && isImage(invoice.evidence_path) ? (
            <img src={evidenceUrl} alt="Delivery evidence" className="mt-4 max-h-72 w-full rounded-2xl border border-slate-200/80 object-contain shadow-sm" />
          ) : (
            <p className="mt-4 text-xs text-slate-500">No proof photo available.</p>
          )}
          {evidenceUrl && !isImage(invoice.evidence_path) && (
            <a href={evidenceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-[#0070BA] underline hover:text-[#003087]">
              Open evidence file &rarr;
            </a>
          )}
          {invoiceUrl && (
            <p className="mt-3">
              <a href={invoiceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#0070BA] underline hover:text-[#003087]">
                Open original invoice PDF or image &rarr;
              </a>
            </p>
          )}
        </section>

        {payoutCountryRestricted && (
          <section role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-xs text-amber-950">
            <h2 className="font-extrabold text-sm">PayPal payout unavailable</h2>
            <p className="mt-2 leading-relaxed">The current sandbox sender account cannot send payouts from its country. No vendor funds were sent. Configure a Payouts-enabled sandbox Business account from a supported sending country, then retry this invoice.</p>
          </section>
        )}

        <section className="liquid-glass p-6 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight text-[#001435]">Your Decision</h2>
          <PaymentModelNotice />
          {(invoice.status === "ESCALATED" || invoice.status === "AWAITING_VERIFIER" || invoice.status === "FAILED" || invoice.status === "PAYOUT_PENDING" || invoice.status === "PARTIALLY_PAID" || invoice.status === "AWAITING_FUNDS") && (
            <label className="mt-3 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Audit Note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-white/80 bg-white/80 p-2.5 text-sm font-medium text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
                placeholder="Explain the decision, required corrections or investigation outcome (at least 5 characters)."
              />
            </label>
          )}
          {invoice.status === "AWAITING_VERIFIER" && <div className="mt-4 space-y-3 text-sm"><label className="flex items-start gap-2"><input type="checkbox" checked={recipientConfirmed} onChange={(e) => setRecipientConfirmed(e.target.checked)} />I independently confirmed fulfillment with the recipient.</label><label className="block">Confirmation method / reference<textarea maxLength={2000} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Example: school representative confirmed all 10 rackets received, by phone on 9 Nov." className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label><p className="text-xs text-slate-500">This is your recorded attestation. The system does not independently authenticate the recipient.</p></div>}
          {invoice.status === "AWAITING_VERIFIER" && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={pending || !recipientConfirmed || confirmation.trim().length < 5} onClick={() => void decide("approve")} className="button-primary text-xs w-full shadow-md">
                Approve
              </button>
              <button disabled={pending || note.trim().length < 5} onClick={() => void decide("reject")} className="rounded-full border-2 border-rose-600 bg-white hover:bg-rose-50 px-5 py-3 text-xs font-extrabold text-rose-700 transition disabled:opacity-50 dark:border-rose-500/80 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 shadow-xs">
                Reject
              </button>
            </div>
          )}
          {(invoice.status === "AWAITING_VERIFIER" || invoice.status === "ESCALATED") && <div className="mt-3 grid gap-3 sm:grid-cols-2"><button disabled={pending || note.trim().length < 5} onClick={() => void decide("request-evidence")} className="button-secondary text-xs">Request more evidence</button>{invoice.status === "AWAITING_VERIFIER" ? <button disabled={pending || note.trim().length < 5} onClick={() => void decide("escalate")} className="button-secondary text-xs">Escalate claim</button> : <button disabled={pending || note.trim().length < 5} onClick={() => void decide("reopen")} className="button-secondary text-xs">Record investigation and return to review</button>}</div>}
          {invoice.status === "ESCALATED" && <p className="mt-3 text-xs">Payout is blocked. An independent verifier must record the investigation outcome before this claim returns to review.</p>}
          {(invoice.status === "FAILED" || invoice.status === "PAYOUT_PENDING" || invoice.status === "PARTIALLY_PAID" || invoice.status === "AWAITING_FUNDS") && (
            <button disabled={pending} onClick={() => void decide("retry")} className="mt-5 w-full rounded-full bg-[#0070BA] hover:bg-[#005ea6] px-5 py-3 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50">
              {invoice.status === "PAYOUT_PENDING" ? "Check payout status" : invoice.status === "PARTIALLY_PAID" || invoice.status === "AWAITING_FUNDS" ? "Pay available funds" : "Retry payout"}
            </button>
          )}
          {pending && <p role="status" className="mt-3 text-xs font-semibold text-slate-500">Submitting verifier decision…</p>}
          {message && <p role="status" className="mt-3 rounded-2xl border border-blue-200/80 bg-blue-50/80 p-3 text-xs font-bold text-[#003087]">{message}</p>}
          {error && <p role="alert" className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900">{error}</p>}
        </section>
      </aside>
    </div>
  );
}
