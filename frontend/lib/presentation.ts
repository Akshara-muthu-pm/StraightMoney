import type { Campaign, Invoice } from "./types";

export type BudgetLineStatus = "paid" | "rejected" | "awaiting-vendor" | "in-review";

export function budgetLineStatus(lineId: number, invoices: Invoice[]): BudgetLineStatus {
  const relevant = invoices.filter((invoice) => invoice.budget_line_id === lineId);
  if (relevant.length === 0) return "awaiting-vendor";
  const rejected = (invoice: Invoice) => invoice.status === "REJECTED" || invoice.status === "VERIFIER_REJECTED";
  if (relevant.some((invoice) => !rejected(invoice) && invoice.status !== "PAID")) return "in-review";
  if (relevant.some((invoice) => invoice.status === "PAID")) return "paid";
  return "rejected";
}

export const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
export const totalFunded = (campaign: Campaign) => campaign.pool_balance + campaign.budget_lines.reduce((sum, line) => sum + line.paid_amount, 0);
export function invoiceStages(invoice: Invoice) {
  const decision = [...invoice.verifications].reverse()[0]?.decision;
  const approved = ["VERIFIER_APPROVED", "AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING", "PAID", "FAILED"].includes(invoice.status);
  const review = decision === "approve" || approved ? "Approved" : decision === "reject" || invoice.status === "VERIFIER_REJECTED" ? "Verifier rejected" : invoice.status === "REJECTED" ? "Policy rejected" : "Awaiting review";
  const payment = invoice.status === "PAID" ? "Paid" : invoice.status === "AWAITING_FUNDS" ? "Awaiting funds" : invoice.status === "PAYOUT_PENDING" ? "Awaiting PayPal confirmation" : invoice.status === "FAILED" ? "Payment failed" : invoice.paid_amount > 0 ? "Partially paid" : "Not paid";
  return { review, payment };
}
