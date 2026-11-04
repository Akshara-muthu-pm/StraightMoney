"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { budgetSummary } from "@/lib/budget";
import { invoiceStages, money } from "@/lib/presentation";
import type { Campaign, Invoice } from "@/lib/types";

export default function BudgetOverview({ campaign }: { campaign: Campaign }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    api.getInvoices(campaign.id).then((items) => {
      if (active) { setInvoices(items); setState("ready"); }
    }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [campaign.id, retry]);

  const rows = campaign.budget_lines.map((line) => budgetSummary(line, invoices));
  const totals = rows.reduce((sum, row) => ({
    planned: sum.planned + row.planned,
    approvedUnpaid: sum.approvedUnpaid + row.approvedUnpaid,
    paid: sum.paid + row.paid,
    remaining: sum.remaining + row.remaining,
  }), { planned: 0, approvedUnpaid: 0, paid: 0, remaining: 0 });
  const amount = (value: number) => money(value, campaign.currency);

  return (
    <section className="liquid-glass p-6 sm:p-8" aria-labelledby="budget-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA]" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087]">Where the money goes</p>
          </div>
          <h2 id="budget-title" className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435]">Campaign spending</h2>
        </div>
        <Link href={`/ledger/${campaign.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/90 px-3.5 py-1.5 text-xs font-bold text-[#003087] transition hover:bg-blue-100/80">
          View public ledger &rarr;
        </Link>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        See what has reached vendors via PayPal Payouts, what is approved and waiting for funds, and what is still open in the plan.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Budget totals">
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">Paid to vendors</p>
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950">{amount(totals.paid)}</p>
          <p className="mt-0.5 text-[11px] text-emerald-800/80">Direct via PayPal Payouts</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900">Approved, unpaid</p>
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-950">{state === "ready" ? amount(totals.approvedUnpaid) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-amber-800/80">Approved payment queue</p>
        </div>
        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">Still uncommitted</p>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-950">{state === "ready" ? amount(totals.remaining) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">Available for allocation</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Planned across all budget lines: <strong className="text-slate-800">{amount(totals.planned)}</strong>. Approved invoices are commitments, not confirmed payments.
      </p>

      {state === "loading" && <p role="status" className="mt-5 text-xs text-slate-500">Loading invoice decisions…</p>}
      {state === "error" && (
        <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          Invoice decisions are unavailable. Confirmed payouts are still shown.{" "}
          <button type="button" className="font-bold underline" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>
            Try again
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3.5">
        {rows.map((row) => {
          const paidWidth = row.planned > 0 ? Math.min(100, (row.paid / row.planned) * 100) : 0;
          const approvedWidth = row.planned > 0 ? Math.min(100 - paidWidth, (row.approvedUnpaid / row.planned) * 100) : 0;
          return (
            <article key={row.line.id} className="rounded-2xl border border-white/80 bg-white/70 p-4 backdrop-blur-md shadow-sm transition hover:border-blue-200 hover:bg-white/90 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                  <h3 className="text-base font-extrabold text-[#001435]">{row.line.name}</h3>
                  <p className="text-xs font-medium text-slate-500">{row.line.vendor_name ?? "Vendor not assigned"}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Planned </span>
                  <strong className="text-sm font-extrabold text-[#001435]">{amount(row.planned)}</strong>
                </div>
              </div>
              {state === "ready" && (
                <div aria-hidden="true" className="mt-3.5 flex h-2.5 overflow-hidden rounded-full border border-slate-200/70 bg-slate-100 shadow-inner">
                  <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500" style={{ width: `${paidWidth}%` }} />
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" style={{ width: `${approvedWidth}%` }} />
                </div>
              )}
              <dl className="mt-4 grid gap-3 text-xs min-[450px]:grid-cols-3">
                <div className="rounded-xl bg-emerald-50/60 p-2.5">
                  <dt className="font-bold text-emerald-800">Paid</dt>
                  <dd className="mt-1 font-extrabold tabular-nums text-slate-900">{amount(row.paid)}</dd>
                </div>
                <div className="rounded-xl bg-amber-50/60 p-2.5">
                  <dt className="font-bold text-amber-800">Approved, unpaid</dt>
                  <dd className="mt-1 font-extrabold tabular-nums text-slate-900">{state === "ready" ? amount(row.approvedUnpaid) : "—"}</dd>
                </div>
                <div className="rounded-xl bg-slate-100/60 p-2.5">
                  <dt className="font-bold text-slate-600">Remaining</dt>
                  <dd className="mt-1 font-extrabold tabular-nums text-slate-900">{state === "ready" ? amount(row.remaining) : "—"}</dd>
                </div>
              </dl>
              {state === "ready" && row.overcommitted > 0 && (
                <p className="mt-3 text-xs font-bold text-amber-900">Approved invoices exceed this budget line by {amount(row.overcommitted)}.</p>
              )}
              {state === "ready" && (
                <details className="mt-4 border-t border-slate-200/70 pt-3">
                  <summary className="cursor-pointer text-xs font-bold text-[#003087] hover:text-[#0070BA] transition">
                    View invoices ({row.invoices.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {row.invoices.length === 0 ? (
                      <p className="text-xs text-slate-500">No invoices submitted yet.</p>
                    ) : (
                      row.invoices.map((invoice) => {
                        const stages = invoiceStages(invoice);
                        return (
                          <div key={invoice.id} className="rounded-xl border border-slate-100 bg-slate-50/90 p-3 text-xs">
                            <div className="flex flex-wrap justify-between gap-1">
                              <p className="font-bold text-[#001435]">Invoice {invoice.invoice_number}</p>
                              <p className="font-black tabular-nums text-[#003087]">{amount(invoice.amount)}</p>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">Review: <strong className="text-slate-700">{stages.review}</strong> · Payment: <strong className="text-slate-700">{stages.payment}</strong></p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
