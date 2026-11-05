"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { recordReceipt } from "@/lib/demo-session";
import type { Donation } from "@/lib/types";

type Result =
  | { kind: "checking" }
  | { kind: "captured"; donation: Donation }
  | { kind: "pending" }
  | { kind: "failed"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "cancelled" };

export default function PayPalReturnClient({ token, cancelled, campaignId }: { token: string | null; cancelled: boolean; campaignId: number | null }) {
  const [result, setResult] = useState<Result>(cancelled ? { kind: "cancelled" } : token ? { kind: "checking" } : { kind: "failed", message: "PayPal did not return an order ID, so this payment cannot be confirmed here." });
  const started = useRef(false);

  const checkPayment = useCallback(async (id: string) => {
    setResult({ kind: "checking" });
    try {
      const donation = await api.captureDonation(id);
      if (donation.status === "captured") {
        const campaign = await api.getCampaign(donation.campaign_id).catch(() => null);
        recordReceipt(donation, campaign?.title ?? "Community campaign", "sandbox");
        setResult({ kind: "captured", donation });
      } else if (donation.status === "pending") {
        setResult({ kind: "pending" });
      } else {
        setResult({ kind: "failed", message: "PayPal did not complete this payment. No funds were added to the campaign." });
      }
    } catch (cause) {
      setResult({ kind: "uncertain", message: cause instanceof Error ? cause.message : "Payment status could not be confirmed. Check again before starting another donation." });
    }
  }, []);

  useEffect(() => {
    if (started.current || cancelled || !token) return;
    started.current = true;
    void checkPayment(token);
  }, [cancelled, checkPayment, token]);

  const backHref = campaignId ? `/campaigns/${campaignId}#donate` : "/donate";
  const ledgerHref = result.kind === "captured" ? `/ledger/${result.donation.campaign_id}` : campaignId ? `/ledger/${campaignId}` : null;

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-16">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/80 bg-white/90 p-8 text-center shadow-xl shadow-blue-950/10 sm:p-12" aria-live="polite">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-2xl text-brand-900" aria-hidden="true">
          {result.kind === "captured" ? "✓" : result.kind === "checking" ? "…" : "↗"}
        </span>
        <p className="eyebrow mt-6">PayPal Sandbox</p>
        <h1 className="display-heading mt-3 text-3xl sm:text-4xl">
          {result.kind === "checking" ? "Confirming your payment" : result.kind === "captured" ? "Donation confirmed" : result.kind === "cancelled" ? "Checkout cancelled" : result.kind === "pending" ? "Payment pending" : result.kind === "failed" ? "Payment not completed" : "Status unconfirmed"}
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
          {result.kind === "checking" && "We are checking your PayPal order and campaign balance."}
          {result.kind === "captured" && `${result.donation.currency} ${result.donation.amount.toFixed(2)} was captured and added to the campaign.`}
          {result.kind === "cancelled" && "You left PayPal without approving the payment. No donation was captured."}
          {result.kind === "pending" && "PayPal has not completed this payment. No funds have been added yet. Check its status before making another donation."}
          {(result.kind === "failed" || result.kind === "uncertain") && result.message}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {(result.kind === "pending" || result.kind === "uncertain") && token && (
            <button type="button" onClick={() => void checkPayment(token)} className="button-primary text-sm">Check payment status</button>
          )}
          {ledgerHref && <Link href={ledgerHref} className="button-secondary text-sm">View public ledger</Link>}
          <Link href={backHref} className="button-secondary text-sm">Back to campaign</Link>
        </div>
      </section>
    </main>
  );
}
