"use client";

import { useState, type FormEvent } from "react";
import { api, USE_MOCKS } from "@/lib/api";
import type { Campaign } from "@/lib/types";

type LineDraft = { name: string; amount: string; vendor: string; email: string };

export default function OrganizerForm({
  campaign,
  onCreated,
}: {
  campaign?: Campaign;
  onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { name: "", amount: "", vendor: "", email: "" },
  ]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const update = (index: number, field: keyof LineDraft, value: string) =>
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((current) => current.filter((_, i) => i !== index));
  };

  const totalLinesAmount = lines.reduce(
    (sum, line) => sum + (Number(line.amount) > 0 ? Number(line.amount) : 0),
    0
  );
  const numericGoal = Number(goal) > 0 ? Number(goal) : 0;

  const budgetMatches = numericGoal > 0 && Math.round(totalLinesAmount * 100) === Math.round(numericGoal * 100);
  const budgetDifference = Math.round((numericGoal - totalLinesAmount) * 100) / 100;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!budgetMatches) { setError("Allocate the entire campaign goal across vendor budget lines exactly before creating the campaign."); return; }
    setPending(true);
    setError("");
    setMessage("");

    try {
      const vendors = Array.from(
        new Map(
          lines.map((line) => [
            line.email.trim().toLowerCase(),
            { name: line.vendor.trim(), payout_email: line.email.trim() },
          ])
        ).values()
      );

      const created = await api.createCampaign({
        beneficiary: beneficiary.trim(),
        expected_deliverables: deliverables.trim(),
        title: title.trim(),
        description: description.trim(),
        goal_amount: Number(goal),
        currency: "USD",
        organizer_name: organizer.trim(),
        vendors,
        budget_lines: lines.map((line) => ({
          name: line.name.trim(),
          budgeted_amount: Number(line.amount),
          vendor_name: line.vendor.trim(),
          vendor_payout_email: line.email.trim(),
        })),
      });

      setMessage(
        USE_MOCKS
          ? "Demo campaign preview created; no data was saved."
          : `Campaign ${created.id} created.`
      );
      if (!USE_MOCKS) onCreated(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create campaign.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] items-start">
      <form onSubmit={submit} className="liquid-glass p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
              Campaign Setup
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435] dark:text-white">
            Campaign details &amp; budget allocation
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Define the public goal, line items, and assigned vendors. Organizers never hold the funds: donations are captured to the campaign pool and paid to vendors.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Beneficiary<input required maxLength={2000} value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Who receives the goods or services?" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label>
          <label className="text-sm font-bold">Expected deliverables<textarea required maxLength={5000} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="Items, quantities and delivery expectations" className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">Changes to the target, beneficiary, deliverables or vendor assignments use recorded amendments reviewed by an independent verifier.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Campaign Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Neighborhood Community Garden"
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white placeholder:text-slate-400"
            />
          </label>

          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Fundraising Goal (USD)
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="1200.00"
              className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white placeholder:text-slate-400 tabular-nums"
            />
          </label>
        </div>

        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Organizer Name / Organization
          <input
            required
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
            placeholder="e.g. Lincoln Elementary PTA"
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white placeholder:text-slate-400"
          />
        </label>

        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Project Description &amp; Purpose
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what will be accomplished with this funding and how each vendor line contributes..."
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm font-medium text-[#001435] shadow-xs backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 dark:border-white/10 dark:bg-slate-900/90 dark:text-white placeholder:text-slate-400 leading-relaxed"
          />
        </label>

        {/* Budget Line Allocations Matrix */}
        <div className="space-y-4 border-t border-slate-200/60 pt-5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-[#001435] dark:text-white">
                Budget Lines &amp; Assigned Vendors
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Total lines allocated:{" "}
                <strong className="text-[#003087] dark:text-[#38bdf8] tabular-nums font-black">
                  ${totalLinesAmount.toFixed(2)}
                </strong>
                {numericGoal > 0 && (
                  <span className="ml-1 text-slate-500">
                    of ${numericGoal.toFixed(2)} goal ({Math.round((totalLinesAmount / numericGoal) * 100)}%)
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { name: "", amount: "", vendor: "", email: "" },
                ])
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/90 px-3 py-1.5 text-xs font-extrabold text-[#003087] shadow-2xs backdrop-blur-md transition hover:bg-blue-100 hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-sky-300"
            >
              + Add Budget Line
            </button>
          </div>

          <div className="space-y-3.5">
            {lines.map((line, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-2xs backdrop-blur-md space-y-3 dark:border-white/10 dark:bg-slate-900/70"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-[#003087] dark:bg-blue-950 dark:text-sky-300">
                      {index + 1}
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-[#003087] dark:text-sky-300">
                      Line Item #{index + 1}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length <= 1}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60 dark:hover:bg-rose-900/60 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                    title={lines.length <= 1 ? "A campaign requires at least one budget line" : `Delete line item #${index + 1}`}
                    aria-label={`Delete line item ${index + 1}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Item Name
                    <input
                      required
                      value={line.name}
                      onChange={(e) => update(index, "name", e.target.value)}
                      placeholder="e.g. Hardwood Shelving Unit"
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001435] transition focus:border-[#0070BA] focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Budget Cap (USD)
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => update(index, "amount", e.target.value)}
                      placeholder="400.00"
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001435] transition focus:border-[#0070BA] focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white tabular-nums"
                    />
                  </label>

                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Assigned Vendor Name
                    <input
                      required
                      value={line.vendor}
                      onChange={(e) => update(index, "vendor", e.target.value)}
                      placeholder="e.g. City Timber Co."
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001435] transition focus:border-[#0070BA] focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Vendor PayPal Email
                    <input
                      required
                      type="email"
                      value={line.email}
                      onChange={(e) => update(index, "email", e.target.value)}
                      placeholder="vendor@example.com"
                      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#001435] transition focus:border-[#0070BA] focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p role="status" className={`rounded-xl border p-4 text-sm ${budgetMatches ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" : "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100"}`}>
          {budgetMatches ? "The full campaign goal is allocated to vendor budget lines." : numericGoal <= 0 ? "Enter a campaign goal and allocate it fully to vendor budget lines." : budgetDifference > 0 ? `$${budgetDifference.toFixed(2)} remains unallocated. Split this amount among the vendor budget lines.` : `Budget lines exceed the goal by $${Math.abs(budgetDifference).toFixed(2)}. Reduce the allocations or update the goal.`}
        </p>
        <div className="pt-2">
          <button
            type="submit"
            disabled={pending || !title.trim() || numericGoal <= 0 || !budgetMatches}
            className="button-primary w-full shadow-lg shadow-blue-950/15 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-extrabold"
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Publishing campaign…
              </span>
            ) : USE_MOCKS ? (
              "Preview campaign"
            ) : (
              "Publish campaign to public ledger"
            )}
          </button>
        </div>

        {message && (
          <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>

      {campaign ? (
        <aside className="liquid-glass p-6 sm:p-7 space-y-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
            Reference Campaign
          </p>
          <h2 className="text-xl font-extrabold text-[#001435] dark:text-white">
            {campaign.title}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Goal: <strong className="text-[#001435] dark:text-white tabular-nums">${campaign.goal_amount.toLocaleString()}</strong> &middot; {campaign.budget_lines.length} assigned vendors
          </p>
          <ul className="mt-4 divide-y divide-slate-200/60 dark:divide-white/10 text-xs">
            {campaign.budget_lines.map((line) => (
              <li key={line.id} className="flex justify-between py-2.5">
                <div>
                  <strong className="block text-[#001435] dark:text-white">{line.name}</strong>
                  <span className="text-[11px] text-slate-500">{line.vendor_name}</span>
                </div>
                <strong className="text-[#003087] dark:text-sky-300 tabular-nums">
                  ${line.budgeted_amount.toFixed(2)}
                </strong>
              </li>
            ))}
          </ul>
        </aside>
      ) : (
        <aside className="liquid-glass p-6 sm:p-7 space-y-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-sky-400">
            Architectural Guardrail
          </p>
          <h2 className="text-xl font-extrabold text-[#001435] dark:text-white">
            Plan before spending.
          </h2>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Add each budget item, its assigned vendor, and registered PayPal email.
            Incoming donor payments are captured into the campaign balance, but PayPal Payouts
            can only be disbursed to the assigned vendors registered here.
          </p>
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-[#003087] dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-sky-200">
            <strong>Immutable rule:</strong> Organizers never hold funds. Every disbursement requires verified invoice paperwork and human approval.
          </div>
        </aside>
      )}
    </div>
  );
}
