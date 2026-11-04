import type { BudgetLine, Invoice } from "./types";

const approvedStatuses = new Set(["VERIFIER_APPROVED", "AWAITING_FUNDS", "PARTIALLY_PAID", "PAYOUT_PENDING", "PAID", "FAILED"]);

export function budgetSummary(line: BudgetLine, invoices: Invoice[]) {
  const lineInvoices = invoices.filter((invoice) => invoice.budget_line_id === line.id);
  const approved = lineInvoices.filter((invoice) =>
    invoice.verifications.some((decision) => decision.decision === "approve" || decision.decision === "test_override") ||
    approvedStatuses.has(invoice.status)
  );
  const planned = line.budgeted_amount;
  const paid = line.paid_amount;
  const approvedUnpaid = approved.reduce((sum, invoice) => sum + Math.max(0, invoice.amount - invoice.paid_amount), 0);
  const remaining = Math.max(0, planned - paid - approvedUnpaid);
  const overcommitted = Math.max(0, paid + approvedUnpaid - planned);
  return { line, invoices: lineInvoices, approvedCount: approved.length, planned, approvedUnpaid, paid, remaining, overcommitted };
}
