import type { Campaign, Invoice } from "./types";

export type BudgetLineStatus = "paid" | "rejected" | "awaiting-vendor" | "in-review" | "approved" | "payment-pending" | "partially-paid" | "payment-failed" | "evidence-required" | "escalated" | "simulated";

export function budgetLineStatus(lineId: number, invoices: Invoice[]): BudgetLineStatus {
  const relevant = invoices.filter((invoice) => invoice.budget_line_id === lineId);
  if (relevant.length === 0) return "awaiting-vendor";
  const active = relevant.filter((invoice) => !["REJECTED", "VERIFIER_REJECTED"].includes(invoice.status));
  if (!active.length) return "rejected";
  if (active.some((i) => i.status === "ESCALATED")) return "escalated";
  if (active.some((i) => i.status === "MORE_EVIDENCE_REQUIRED")) return "evidence-required";
  if (active.some((i) => ["AWAITING_VERIFIER", "SUBMITTED", "EXTRACTED", "CHECKED", "NEEDS_REVIEW"].includes(i.status))) return "in-review";
  const unpaid = active.filter((i) => i.status !== "PAID");
  if (unpaid.some((i) => i.payment_mode === "simulated" || /payout was simulated/i.test(i.ai_summary || ""))) return "simulated";
  if (unpaid.some((i) => i.status === "FAILED")) return "payment-failed";
  if (unpaid.some((i) => i.status === "PAYOUT_PENDING")) return "payment-pending";
  if (unpaid.some((i) => i.status === "PARTIALLY_PAID")) return "partially-paid";
  if (unpaid.some((i) => ["AWAITING_FUNDS", "VERIFIER_APPROVED"].includes(i.status))) return "approved";
  return active.some((i) => i.status === "PAID") ? "paid" : "in-review";
}

export const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
export const totalFunded = (campaign: Campaign) => campaign.pool_balance + campaign.budget_lines.reduce((sum, line) => sum + line.paid_amount, 0);
export function invoiceStages(invoice: Invoice) {
  const decision = [...invoice.verifications].reverse()[0]?.decision;
  const approved = ["VERIFIER_APPROVED", "AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING", "PAID", "FAILED"].includes(invoice.status);
  const review = invoice.status === "MORE_EVIDENCE_REQUIRED" ? "More evidence required" : invoice.status === "ESCALATED" ? "Escalated — investigation required" : invoice.status === "AWAITING_VERIFIER" ? "Awaiting independent review" : decision === "approve" || approved ? "Approved" : decision === "reject" || invoice.status === "VERIFIER_REJECTED" ? "Verifier rejected" : invoice.status === "REJECTED" ? "Policy rejected" : "Awaiting review";
  const payment = (invoice.payment_mode === "simulated" || /payout was simulated/i.test(invoice.ai_summary || "")) && invoice.paid_amount === 0 ? "Simulated — no funds sent" : invoice.status === "PAID" ? "Payment successful" : invoice.status === "AWAITING_FUNDS" ? "Awaiting funds" : invoice.status === "PAYOUT_PENDING" ? "Awaiting PayPal confirmation" : invoice.status === "FAILED" ? "Payment failed" : invoice.paid_amount > 0 ? "Partially paid" : "Not paid";
  return { review, payment };
}
