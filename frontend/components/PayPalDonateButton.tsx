"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { recordReceipt, useDemoSession } from "@/lib/demo-session";
import type { CampaignAvailability } from "@/lib/types";

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

type Outcome =
  | { kind: "captured"; amount: number; source: "paypal" | "simulated"; refreshFailed?: boolean }
  | { kind: "pending"; orderId: string }
  | { kind: "failed"; detail: string }
  | { kind: "cancelled"; detail: string }
  | { kind: "uncertain"; orderId: string; detail: string }
  | { kind: "preview"; detail: string };

const donationTiers = [
  { value: 10, label: "Supporter" },
  { value: 25, label: "Community" },
  { value: 50, label: "Popular" },
  { value: 100, label: "Champion" },
];

export default function PayPalDonateButton({
  campaignId,
  campaignTitle = "Community campaign",
  currency = "USD",
  progressHref = "#updates",
  onCaptured,
}: {
  campaignId: number;
  campaignTitle?: string;
  currency?: string;
  progressHref?: string;
  onCaptured?: () => void | Promise<void>;
}) {
  const session = useDemoSession();
  const [name, setName] = useState(session?.name || "");
  const [amount, setAmount] = useState("25");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [availability, setAvailability] = useState<CampaignAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const helpId = useId();
  const configuredMaximum = Number(process.env.NEXT_PUBLIC_MAX_DONATION_AMOUNT || 5000);
  const maxDonationAmount = Number.isFinite(configuredMaximum) && configuredMaximum > 0 ? configuredMaximum : 5000;
  const amountLimit = Math.min(maxDonationAmount, availability?.remaining ?? 0);
  const numAmount = Number(amount);
  const valid = !availabilityError && Boolean(name.trim()) && Number.isFinite(numAmount) && numAmount >= 0.01 && numAmount <= amountLimit && availability?.status === "active" && Math.abs(numAmount * 100 - Math.round(numAmount * 100)) < 0.000001;
  const awaitingPayment = outcome?.kind === "pending" || outcome?.kind === "uncertain";

  useEffect(() => {
    let active = true;
    api.campaignAvailability(campaignId)
      .then((value) => { if (active) { setAvailability(value); setAvailabilityError(""); } })
      .catch(() => { if (active) { setAvailability(null); setAvailabilityError("Could not check the remaining campaign amount. Please try again."); } });
    return () => { active = false; };
  }, [campaignId]);

  const refreshAvailability = async () => {
    try {
      const value = await api.campaignAvailability(campaignId);
      setAvailability(value);
      setAvailabilityError("");
      return value;
    } catch (cause) {
      setAvailability(null);
      setAvailabilityError("Could not check the remaining campaign amount. Please try again.");
      throw cause;
    }
  };

  const completeOrder = async (orderId: string) => {
    setCapturing(true);
    setError("");
    try {
      const donation = await api.captureDonation(orderId);
      if (donation.status === "captured") {
        recordReceipt(donation, campaignTitle, donation.source === "simulated" ? "simulated" : "sandbox");
        let refreshFailed = false;
        try {
          await onCaptured?.();
        } catch {
          refreshFailed = true;
        }
        setOutcome({ kind: "captured", amount: donation.amount, source: donation.source, refreshFailed });
      } else if (donation.status === "pending") {
        setOutcome({ kind: "pending", orderId });
      } else if (donation.status === "failed") {
        setOutcome({ kind: "failed", detail: "PayPal did not complete this donation. No funds were credited. You may start a new checkout." });
      } else {
        setOutcome({ kind: "uncertain", orderId, detail: "Payment status is not yet confirmed. You can check status below." });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confirmation failed. Check status below.");
      setOutcome({ kind: "uncertain", orderId, detail: "We could not confirm the payment. Check status below." });
    } finally {
      await refreshAvailability().catch(() => undefined);
      setCapturing(false);
    }
  };

  const startPayPalCheckout = async () => {
    if (!valid || capturing || awaitingPayment) return;
    setCapturing(true);
    setError("");
    setOutcome(null);
    try {
      const latest = await refreshAvailability();
      if (latest.status !== "active" || numAmount > latest.remaining) {
        throw new Error(`Only ${currency} ${latest.remaining.toFixed(2)} remains available for this campaign.`);
      }
      const donation = await api.createDonation(campaignId, name.trim(), numAmount, false);
      if (!donation.approval_url) throw new Error("PayPal did not provide a checkout page. Please try again.");
      const approvalUrl = new URL(donation.approval_url);
      if (approvalUrl.protocol !== "https:" || !["www.sandbox.paypal.com", "sandbox.paypal.com"].includes(approvalUrl.hostname)) {
        throw new Error("PayPal did not provide a valid Sandbox checkout page. Please try again.");
      }
      window.location.assign(approvalUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start PayPal checkout.");
      await refreshAvailability().catch(() => undefined);
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-5" aria-busy={capturing}>
      <div role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold text-[#003087] dark:bg-blue-950/40 dark:text-sky-200">
        {availabilityError ? <><span>{availabilityError}</span> <button type="button" className="underline" onClick={() => void refreshAvailability().catch(() => undefined)}>Try again</button></>
          : availability === null ? "Checking the remaining campaign amount…"
          : availability.status !== "active" ? "This campaign is not accepting donations."
          : availability.remaining <= 0 && availability.raised >= availability.goal ? "This campaign is fully funded and is no longer accepting donations."
          : availability.remaining <= 0 ? `${currency} ${availability.reserved.toFixed(2)} is held in open checkouts. No donation capacity is available right now.`
          : `${currency} ${availability.remaining.toFixed(2)} remains available${availability.reserved > 0 ? ` (${currency} ${availability.reserved.toFixed(2)} held in open checkouts)` : ""}.`}
        {availability && availability.remaining <= 0 && availability.status === "active" && (
          <button type="button" className="ml-2 underline" onClick={() => void refreshAvailability().catch(() => undefined)}>
            Check availability
          </button>
        )}
      </div>
      {amountLimit > 0 && <>
      {/* Optimized Preset Amount Tiles */}
      <fieldset disabled={capturing || awaitingPayment || amountLimit <= 0} className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Select Donation Amount ({currency})
          </legend>
          {Number(amount) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-[11px] font-black text-[#003087] shadow-2xs dark:border-blue-500/30 dark:bg-blue-950/60 dark:text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
              Selected: ${Number(amount).toFixed(2)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {donationTiers.map((tier) => {
            const isSelected = Number(amount) === tier.value;
            return (
              <button
                key={tier.value}
                type="button"
                disabled={tier.value > amountLimit}
                aria-pressed={isSelected}
                onClick={() => {
                  setAmount(String(tier.value));
                  setError("");
                  setOutcome(null);
                }}
                className={`group relative flex flex-col items-center justify-center rounded-2xl py-3 px-2 text-center transition-all duration-200 ${
                  isSelected
                    ? "border-2 border-[#003087] bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0070BA] text-white shadow-md shadow-blue-900/25 ring-4 ring-[#0070BA]/25 scale-[1.02] dark:border-[#009CDE] dark:from-[#0047a8] dark:to-[#001c54] dark:ring-[#009CDE]/25"
                    : "border-2 border-slate-200 bg-white text-[#001435] shadow-xs hover:border-[#0070BA] hover:bg-blue-50/50 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99] dark:border-white/15 dark:bg-slate-900/80 dark:text-white dark:hover:border-[#009CDE]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight">${tier.value}</span>
                  {isSelected && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#003087] shadow-2xs">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider mt-0.5 ${
                    isSelected
                      ? "text-blue-100 dark:text-sky-200"
                      : "text-slate-500 dark:text-slate-400 group-hover:text-[#0070BA] dark:group-hover:text-sky-300"
                  }`}
                >
                  {tier.label}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Inputs: Name & Custom Amount */}
      <div className="space-y-2">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Donor Name
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                autoComplete="name"
                maxLength={100}
                required
                disabled={capturing || awaitingPayment || amountLimit <= 0}
                aria-describedby={helpId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-bold text-[#001435] shadow-xs transition hover:border-slate-300 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-white/15 dark:bg-slate-900/80 dark:text-white dark:placeholder-slate-400 dark:focus:border-[#009CDE]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>Custom Amount</span>
              <span className="text-[10px] font-bold text-slate-400">({currency})</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base font-black text-slate-400">
                $
              </span>
              <input
                required
                disabled={capturing || awaitingPayment || amountLimit <= 0}
                inputMode="decimal"
                aria-describedby={helpId}
                type="number"
                min="0.01"
                max={amountLimit}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm font-bold text-[#001435] shadow-xs transition hover:border-slate-300 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-white/15 dark:bg-slate-900/80 dark:text-white dark:placeholder-slate-400 dark:focus:border-[#009CDE]"
              />
            </div>
          </div>
        </div>

        <p id={helpId} className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 font-medium">
          Enter your name and up to {currency} {amountLimit.toFixed(2)}. Your name appears on the public ledger.
        </p>
      </div>

      {/* Dedicated PayPal Checkout Panel */}
      <div className="rounded-3xl border-2 border-blue-100 bg-gradient-to-b from-blue-50/50 via-white to-sky-50/30 p-5 shadow-xs transition-colors dark:border-white/10 dark:bg-none dark:bg-slate-900/95 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-blue-100/80 pb-3.5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0079C1] p-1.5 shadow-xs">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
                <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
                <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
              </svg>
            </span>
            <div>
              <span className="block text-xs font-black text-[#001435] dark:text-white">PayPal Instant Checkout</span>
              <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Sandbox campaign checkout</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-700 shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">VISA</span>
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-700 shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">MC</span>
            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-700 shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">AMEX</span>
          </div>
        </div>

        {/* Dynamic Readiness Status */}
        {!name.trim() ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900 shadow-2xs dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            <svg className="h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Please enter your name above to activate PayPal Checkout.</span>
          </div>
        ) : valid ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-900 shadow-2xs dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Ready: <strong>{currency} {Number(amount).toFixed(2)}</strong> donation by {name.trim()}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Secured</span>
          </div>
        ) : null}

        {USE_MOCKS ? (
          <div className="space-y-3">
            <button
              type="button"
              disabled={!valid || awaitingPayment}
              onClick={() => {
                setError("");
                setOutcome({
                  kind: "preview",
                  detail: `Demo only: a ${currency} ${Number(amount).toFixed(2)} donation by ${name.trim()} would start PayPal checkout. No payment or donation record was created.`,
                });
              }}
              className="button-gold relative flex w-full items-center justify-center gap-2.5 rounded-full py-3.5 px-6 text-sm font-black text-[#001435] shadow-lg shadow-[#FFC439]/30 transition hover:shadow-xl hover:shadow-[#FFC439]/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
                <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
                <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
              </svg>
              <span>Donate {valid ? `${currency} ${Number(amount).toFixed(2)}` : ""} with PayPal</span>
            </button>
            <p className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              No PayPal account required &mdash; debit and credit cards processed directly.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button type="button" disabled={!valid || capturing || awaitingPayment} onClick={() => void startPayPalCheckout()} className="button-gold flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
              {capturing ? "Opening PayPal Sandbox…" : `Continue to PayPal Sandbox${valid ? ` — ${currency} ${numAmount.toFixed(2)}` : ""}`}
            </button>
            <p className="text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              You will leave StraightMoney to approve this test payment on PayPal, then return here for confirmation.
            </p>
          </div>
        )}

        {/* Sandbox Help Details */}
        <details className="rounded-2xl border border-blue-100 bg-white/90 p-4 text-xs text-slate-700 shadow-2xs space-y-2 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
          <summary className="cursor-pointer py-0.5 font-bold text-[#003087] hover:text-[#0070BA] transition dark:text-sky-300 dark:hover:text-sky-200">
            Sandbox checkout test credentials
          </summary>
          <div className="font-extrabold text-[#001435] dark:text-white pt-1">PayPal Sandbox Test Card:</div>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            To test Sandbox checkout (no real card charge): Click <strong>&ldquo;Debit or Credit Card&rdquo;</strong> and enter Test Card:{" "}
            <code className="rounded-md border border-slate-200 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[#001435] dark:border-white/10 dark:bg-slate-800 dark:text-amber-300">
              4012 8888 8888 1881
            </code>{" "}
            (Exp: <code className="rounded-md border border-slate-200 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[#001435] dark:border-white/10 dark:bg-slate-800 dark:text-amber-300">12/28</code>, CVV:{" "}
            <code className="rounded-md border border-slate-200 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[#001435] dark:border-white/10 dark:bg-slate-800 dark:text-amber-300">123</code>, Zip:{" "}
            <code className="rounded-md border border-slate-200 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[#001435] dark:border-white/10 dark:bg-slate-800 dark:text-amber-300">95131</code>).
          </p>
        </details>
      </div>
      </>}

      {capturing && (
        <div role="status" className="flex items-center gap-2 text-xs font-bold text-[#0070BA]">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#0070BA] border-t-transparent" />
          Checking donation status with PayPal…
        </div>
      )}

      {outcome && (
        <section
          role="status"
          aria-live="polite"
          className={`rounded-2xl border-2 p-4 text-xs shadow-xs ${
            outcome.kind === "captured"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
              : outcome.kind === "pending" || outcome.kind === "uncertain"
              ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-slate-200 bg-white text-slate-900 dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-100"
          }`}
        >
          <h4 className="font-extrabold text-sm">
            {outcome.kind === "captured"
              ? "Donation captured"
              : outcome.kind === "pending"
              ? "Payment pending"
              : outcome.kind === "failed"
              ? "Payment failed"
              : outcome.kind === "cancelled"
              ? "Checkout cancelled"
              : outcome.kind === "uncertain"
              ? "Status unconfirmed"
              : "Preview only"}
          </h4>
          <p className="mt-1 leading-relaxed">
            {outcome.kind === "captured"
              ? `${currency} ${outcome.amount.toFixed(2)} was added to this campaign.${
                  outcome.source === "simulated"
                    ? " SIMULATED: no PayPal payment was made."
                    : " PayPal Sandbox confirmed the capture."
                }`
              : outcome.kind === "pending"
              ? "PayPal has not completed this payment. Nothing has been added to the campaign yet. Check the status below before making another donation."
              : outcome.detail}
          </p>
          {outcome.kind === "captured" && outcome.refreshFailed && (
            <p className="mt-2 font-medium">
              The payment is captured, but the displayed campaign totals could not refresh. Check the public ledger.
            </p>
          )}
          {(outcome.kind === "pending" || outcome.kind === "uncertain") && (
            <button
              type="button"
              className="button-secondary mt-3 text-xs"
              disabled={capturing}
              onClick={() => void completeOrder(outcome.orderId)}
            >
              Check payment status
            </button>
          )}
          {(outcome.kind === "captured" || outcome.kind === "uncertain") && (
            <div className="mt-3 flex flex-wrap gap-4 font-bold text-[#003087] dark:text-sky-300">
              <Link href={`/ledger/${campaignId}`} className="underline hover:text-[#0070BA]">
                View public ledger
              </Link>
              {outcome.kind === "captured" && (
                <Link href={progressHref} className="underline hover:text-[#0070BA]">
                  Follow project progress
                </Link>
              )}
              {outcome.kind === "captured" && session?.role === "Donor" && (
                <Link href="/donor" className="underline hover:text-[#0070BA]">
                  My donation history
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {USE_MOCKS && (
        <p className="text-xs text-slate-500 dark:text-slate-400">Demo mode uses mock data. No payment is made.</p>
      )}
    </div>
  );
}
