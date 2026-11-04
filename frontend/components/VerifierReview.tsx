"use client";
/* eslint-disable @next/next/no-img-element -- The API serves user-uploaded evidence at runtime. */

import { useState } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import InvoiceStages from "./InvoiceStages";

const TEST_OVERRIDE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VERIFIER_TEST_OVERRIDE !== "false";

export default function VerifierReview({ invoice, verifierKey, onChanged }: { invoice: Invoice; verifierKey: string; onChanged: (updated: Invoice) => void }) {
  const [verifierName, setVerifierName] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const payoutCountryRestricted = /PAYOUT_NOT_AVAILABLE|country that is not allowed to send this payout|sandbox sender account.s country/i.test(invoice.ai_summary ?? "");
  const advisorySummary = (invoice.ai_summary ?? "").split("\nPayout was simulated")[0].split("\nPayout failed:")[0].split("\nPayPal Payouts are unavailable")[0];
  const evidenceUrl = api.assetUrl(invoice.evidence_path);
  const invoiceUrl = api.assetUrl(invoice.raw_file_path);
  const isImage = (path: string | null) => !!path && /\.(png|jpe?g|webp)$/i.test(path);
  const decide = async (action: "approve" | "reject" | "retry" | "test-override") => {
    if (action !== "test-override" && !verifierName.trim()) { setError("Enter your name before continuing."); return; }
    setPending(true); setError(""); setMessage("");
    const body = { verifier_name: verifierName.trim() || "Sandbox tester", note: note.trim() || (action === "test-override" ? "Sandbox payout test" : undefined), override_for_testing: action === "test-override" };
    try {
      const updated = action === "approve" || action === "test-override" ? await api.approveInvoice(invoice.id, body, verifierKey) : action === "reject" ? await api.rejectInvoice(invoice.id, body, verifierKey) : await api.retryInvoice(invoice.id, body, verifierKey);
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
          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Vendor", invoice.vendor_name ?? "Unknown"],
              ["Invoice amount", `$${invoice.amount.toFixed(2)} ${invoice.currency}`],
              ["Paid", `$${invoice.paid_amount.toFixed(2)}`],
              ["Still owed", `$${invoice.remaining_amount.toFixed(2)}`],
              ["Payout email", invoice.payout_email],
              ["Submitted", new Date(invoice.created_at).toLocaleDateString()]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200/60 bg-white/70 p-3 backdrop-blur-sm">
                <dt className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm font-bold text-[#001435]">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 border-t border-slate-200/60 pt-4 text-xs leading-relaxed text-slate-600">
            {invoice.description ?? "No description extracted."}
          </p>
        </section>

        <section className="liquid-glass p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA]" />
            <h2 className="text-xl font-extrabold tracking-tight text-[#001435]">Gemini AI &amp; Policy Check Results</h2>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {invoice.checks.map((check) => (
              <div key={check.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold capitalize text-[#001435]">{check.check_name.replaceAll("_", " ")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{check.detail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${check.passed ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200"}`}>
                    {check.passed ? "Pass" : "Fail"}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${check.severity === "hard" ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-[#E1F0FC] text-[#003087] ring-[#BAE0FC]"}`}>
                    {check.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
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
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#009CDE]" />
            <h2 className="text-xl font-extrabold tracking-tight text-[#001435]">Gemini AI Advisory</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">{advisorySummary || "No advisory summary available."}</p>
          <p className="mt-3 text-[11px] font-semibold text-slate-400">Advisory only. The human verifier makes the final payout decision.</p>
        </section>

        <section className="liquid-glass p-6 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight text-[#001435]">Your Decision</h2>
          {((TEST_OVERRIDE_ENABLED && (invoice.status === "REJECTED" || invoice.status === "AWAITING_VERIFIER" || invoice.status === "NEEDS_REVIEW")) || invoice.status === "AWAITING_VERIFIER" || (invoice.status === "FAILED" || invoice.status === "PAYOUT_PENDING" || invoice.status === "PARTIALLY_PAID" || invoice.status === "AWAITING_FUNDS")) && (
            <>
              <label className="mt-4 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Your name
                <input
                  value={verifierName}
                  onChange={(event) => setVerifierName(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/80 bg-white/80 p-2.5 text-sm font-semibold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
                  placeholder="e.g. Alice Verifier"
                />
              </label>
              <label className="mt-3 block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Audit Note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-white/80 bg-white/80 p-2.5 text-sm font-medium text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
                  placeholder="Optional audit note..."
                />
              </label>
            </>
          )}
          {invoice.status === "AWAITING_VERIFIER" && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={pending} onClick={() => void decide("approve")} className="button-primary text-xs w-full shadow-md">
                Approve
              </button>
              <button disabled={pending} onClick={() => void decide("reject")} className="rounded-full border-2 border-rose-600 bg-white hover:bg-rose-50 px-5 py-3 text-xs font-extrabold text-rose-700 transition disabled:opacity-50">
                Reject
              </button>
            </div>
          )}
          {TEST_OVERRIDE_ENABLED && invoice.amount > 0 && (invoice.status === "REJECTED" || invoice.status === "AWAITING_VERIFIER" || invoice.status === "NEEDS_REVIEW") && (
            <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
              <p className="font-semibold leading-relaxed">Sandbox test override: approve this invoice and attempt to send available funds to the vendor&apos;s registered PayPal account. App policy and AI checks are bypassed. PayPal can still reject the transfer, and no money is marked paid unless PayPal confirms it.</p>
              <button disabled={pending} onClick={() => void decide("test-override")} className="mt-3 w-full rounded-full bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50">
                Approve for sandbox test
              </button>
            </div>
          )}
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
