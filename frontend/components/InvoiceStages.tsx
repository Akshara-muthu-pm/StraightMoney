import type { Invoice } from "@/lib/types";
import { invoiceStages, money } from "@/lib/presentation";

export default function InvoiceStages({ invoice }: { invoice: Invoice }) {
  const stages = invoiceStages(invoice);
  return <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice review</dt><dd className="mt-1 font-semibold">{stages.review}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor payment</dt><dd className="mt-1 font-semibold">{stages.payment}</dd><p className="mt-2 text-xs text-slate-600">{money(invoice.paid_amount, invoice.currency)} paid / {money(invoice.remaining_amount, invoice.currency)} owed</p></div></dl>;
}
