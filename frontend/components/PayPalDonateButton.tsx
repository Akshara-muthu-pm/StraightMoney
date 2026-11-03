"use client";

import { useId, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { api, USE_MOCKS } from "@/lib/api";
import Link from "next/link";
import { recordReceipt, useDemoSession } from "@/lib/demo-session";

export default function PayPalDonateButton({
  campaignId,
  campaignTitle = "Community campaign",
  progressHref = "#updates",
  currency = "USD",
  onCaptured,
}: {
  campaignId: number;
  campaignTitle?: string;
  progressHref?: string;
  currency?: string;
  onCaptured: () => Promise<void>;
}) {
  const helpId = useId();
  const session = useDemoSession();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const valid = name.trim().length > 0 && Number.isFinite(Number(amount)) && Number(amount) >= 0.01 && Math.abs(Number(amount) * 100 - Math.round(Number(amount) * 100)) < 0.000001;

  const handleSimulatedDonation = async () => {
    if (!valid) {
      setError(`Enter your name and a valid ${currency} amount.`);
      return;
    }
    setCapturing(true);
    setError("");
    setMessage("");
    try {
      const donation = await api.createDonation(campaignId, name.trim(), Number(amount), true);
      const captured = await api.captureDonation(donation.paypal_order_id);
      recordReceipt(captured, campaignTitle, "simulated");
      setMessage("Simulated donation captured. No PayPal payment was made.");
      try { await onCaptured(); } catch { setError("The simulated donation was captured, but progress could not refresh. Check the ledger before donating again."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete donation.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4" aria-busy={capturing}>
      <fieldset disabled={capturing}><legend className="mb-2 text-sm font-semibold">Choose an amount ({currency})</legend><div className="grid grid-cols-4 gap-2">{[10, 25, 50, 100].map((preset) => <button key={preset} type="button" aria-pressed={Number(amount) === preset} onClick={() => { setAmount(String(preset)); setError(""); setMessage(""); }} className={`rounded-xl border px-2 py-3 text-sm font-bold ${Number(amount) === preset ? "border-brand-700 bg-brand-50 text-brand-900" : "border-slate-300 bg-white text-slate-700 hover:border-brand-700"}`}>{preset}</button>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Your name
          <input
            autoComplete="name"
            maxLength={100}
            required
            disabled={capturing}
            aria-describedby={helpId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jane Doe"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Custom amount ({currency})
          <input
            required
            disabled={capturing}
            inputMode="decimal"
            aria-describedby={helpId}
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <p id={helpId} className="text-xs leading-5 text-slate-600">Enter your name and at least 0.01 {currency}, with up to two decimal places. Your name appears in the public ledger.</p>
      {USE_MOCKS ? (
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            setError("");
            setMessage(`Demo only: a ${currency} ${Number(amount).toFixed(2)} donation by ${name.trim()} would start PayPal checkout.`);
          }}
          className="w-full rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Preview PayPal donation
        </button>
      ) : clientId && !clientId.startsWith("your-") ? (
        <div className="space-y-2">
          <PayPalScriptProvider
            options={{
              clientId: clientId,
              currency: currency,
              intent: "capture",
              enableFunding: "card",
            }}
          >
            <PayPalButtons
              disabled={!valid || capturing}
              forceReRender={[campaignId, amount, name]}
              style={{ layout: "vertical", shape: "rect" }}
              createOrder={async () => {
                if (!valid) throw new Error("Enter your name and a valid donation amount.");
                setError("");
                setMessage("");
                try {
                  const donation = await api.createDonation(campaignId, name.trim(), Number(amount), false);
                  return donation.paypal_order_id;
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Could not start checkout.");
                  throw cause;
                }
              }}
              onApprove={async (data) => {
                setCapturing(true);
                setError("");
                setMessage("PayPal payment approved! Capturing donation into campaign pool…");
                try {
                  const captured = await api.captureDonation(data.orderID);
                  recordReceipt(captured, campaignTitle, captured.paypal_order_id.startsWith("SANDBOX-") ? "simulated" : "sandbox");
                  setMessage("Thank you! Your Sandbox donation was captured.");
                  try { await onCaptured(); } catch { setError("Your donation was captured, but progress could not refresh. Check the ledger before donating again."); }
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Could not capture the donation.");
                } finally {
                  setCapturing(false);
                }
              }}
              onCancel={() => {
                setCapturing(false);
                setMessage("");
                setError("Checkout was cancelled. No donation was captured.");
              }}
              onError={(cause: unknown) => {
                setCapturing(false);
                const msg = (cause as Error)?.message || String(cause) || "PayPal checkout failed.";
                setError(msg);
              }}
            />
          </PayPalScriptProvider>

          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1.5"><summary className="cursor-pointer py-2 font-semibold">Sandbox checkout help</summary>
            <div className="font-semibold text-slate-900">Live PayPal Sandbox Test Info:</div>
            <p>
              To see money <strong>actually deducted in PayPal Sandbox</strong>:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>
                <strong>Card (no login needed):</strong> Click &ldquo;Debit or Credit Card&rdquo;, use Sandbox Test Card: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">4012 8888 8888 1881</code> (Exp: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">12/28</code>, CVV: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">123</code>, Zip: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-900">95131</code>).
              </li>
              <li>
                <strong>PayPal Login:</strong> Log in with your Sandbox Personal (Buyer) test account from <a href="https://developer.paypal.com/dashboard/accounts" target="_blank" rel="noreferrer" className="underline font-medium text-blue-700">developer.paypal.com</a>.
              </li>
            </ul>
          </details>

          <div className="space-y-1 text-center pt-1">
            <button
              type="button"
              disabled={!valid || capturing}
              onClick={handleSimulatedDonation}
              className="text-xs text-slate-500 hover:text-brand-700 underline disabled:opacity-50"
            >
              Simulate donation without PayPal deduction (UI demo mode)
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-amber-800">
            PayPal Sandbox checkout is unavailable. You can try a simulated donation below; no PayPal payment is made.
          </p>
          <button
            type="button"
            disabled={!valid || capturing}
            onClick={handleSimulatedDonation}
            className="w-full rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {capturing ? "Processing..." : `Simulate donation - ${currency} ${Number(amount || 0).toFixed(2)}`}
          </button>
        </div>
      )}

      {capturing && <p role="status" className="text-sm text-slate-600">Capturing donation…</p>}
      {message && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">{message}</p>}
      {message && <div className="flex flex-wrap gap-4 text-sm font-semibold text-brand-800"><Link href={progressHref} className="underline">Follow project progress</Link>{session?.role === "Donor" && <Link href="/donor" className="underline">My donation history</Link>}</div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {USE_MOCKS && <p className="text-xs text-slate-500">Demo mode uses mock data. No payment is made.</p>}
    </div>
  );
}
