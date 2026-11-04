import type { CampaignStatus, InvoiceStatus } from "@/lib/types";

const colors: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  PARTIALLY_PAID: "bg-[#E1F0FC] text-[#003087] ring-[#BAE0FC]",
  AWAITING_VERIFIER: "bg-amber-50 text-amber-800 ring-amber-200",
  AWAITING_FUNDS: "bg-amber-50 text-amber-800 ring-amber-200",
  PAYOUT_PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  NEEDS_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  VERIFIER_REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  FAILED: "bg-rose-50 text-rose-800 ring-rose-200",
};

export default function StatusBadge({ status }: { status: CampaignStatus | InvoiceStatus | string }) {
  const normalized = status.replaceAll("_", " ").toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
        colors[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {normalized}
    </span>
  );
}
