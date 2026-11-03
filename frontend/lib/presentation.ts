import type { Campaign, Invoice } from "./types";

export const money = (value: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
export const totalFunded = (campaign: Campaign) => campaign.pool_balance + campaign.budget_lines.reduce((sum, line) => sum + line.paid_amount, 0);
export function invoiceStages(invoice: Invoice) {
  const decision = [...invoice.verifications].reverse()[0]?.decision;
  const approved = ["VERIFIER_APPROVED", "AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING", "PAID", "FAILED"].includes(invoice.status);
  const review = decision === "test_override" ? "Sandbox override" : decision === "approve" || approved ? "Approved" : decision === "reject" || invoice.status === "VERIFIER_REJECTED" ? "Verifier rejected" : invoice.status === "REJECTED" ? "Policy rejected" : "Awaiting review";
  const payment = invoice.status === "PAID" ? "Paid" : invoice.status === "AWAITING_FUNDS" ? "Awaiting funds" : invoice.status === "PAYOUT_PENDING" ? "Awaiting PayPal confirmation" : invoice.status === "FAILED" ? "Payment failed" : invoice.paid_amount > 0 ? "Partially paid" : "Not paid";
  return { review, payment };
}
