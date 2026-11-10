import type { Invoice } from "@/lib/types";
import { invoiceStages, money } from "@/lib/presentation";

export default function InvoiceStages({ invoice }: { invoice: Invoice }) {
  const stages = invoiceStages(invoice);
  const reasons = invoice.checks.filter((check) => !check.passed && check.severity === "hard").map((check) => check.detail);
  if (invoice.status === "NEEDS_REVIEW" && invoice.ai_summary) reasons.push(invoice.ai_summary);
  if (["MORE_EVIDENCE_REQUIRED", "ESCALATED", "VERIFIER_REJECTED"].includes(invoice.status)) { const note = [...invoice.verifications].reverse()[0]?.note; if (note) reasons.push(note); }
  if (invoice.status === "REJECTED") reasons.push(...invoice.verifications.filter((item) => item.decision === "reject").map((item) => item.note).filter((item): item is string => !!item));
  return <div className="space-y-3"><dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice review</dt><dd className="mt-1 font-semibold">{stages.review}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor payment</dt><dd className="mt-1 font-semibold">{stages.payment}</dd><p className="mt-2 text-xs text-slate-600">{money(invoice.paid_amount, invoice.currency)} paid / {money(invoice.remaining_amount, invoice.currency)} owed</p></div></dl>{reasons.length > 0 && <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100"><p className="font-bold">Why this invoice could not proceed</p><ul className="mt-2 list-disc pl-5">{Array.from(new Set(reasons)).map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}</div>;
}
