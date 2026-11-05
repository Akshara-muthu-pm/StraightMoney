"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { Invoice } from "@/lib/types";

export default function DeliveryCloseoutPanel({ invoice, role, onSaved }: {
  invoice: Invoice;
  role: "Organizer" | "Vendor";
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(invoice.delivery?.delivered_description ?? "");
  const [deliveredAt, setDeliveredAt] = useState(invoice.delivery?.delivered_at?.slice(0, 10) ?? "");
  const [remainingIssue, setRemainingIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const delivery = invoice.delivery;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (role === "Vendor") await api.reportDelivery(invoice.id, description, new Date(`${deliveredAt}T12:00:00Z`).toISOString());
      else await api.acceptDelivery(invoice.id, remainingIssue);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save delivery closeout.");
    } finally {
      setBusy(false);
    }
  }

  if (invoice.status !== "PAID") return null;
  return <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-[#001435]">
    <h4 className="font-extrabold text-[#003087]">Delivery closeout</h4>
    {delivery ? <div className="mt-2 space-y-1 text-slate-700">
      <p><strong>Delivered:</strong> {delivery.delivered_description}</p>
      <p><strong>Delivery date:</strong> {new Date(delivery.delivered_at).toLocaleDateString()}</p>
      <p><strong>Acceptance:</strong> {delivery.accepted_at ? `${new Date(delivery.accepted_at).toLocaleDateString()} · ${delivery.status === "issues_open" ? "Accepted with issue" : "Accepted"}` : "Awaiting organizer acceptance"}</p>
      {delivery.remaining_issue && <p><strong>Remaining issue:</strong> {delivery.remaining_issue}</p>}
    </div> : <p className="mt-2 text-slate-600">Paid. Waiting for the vendor to report what was delivered.</p>}
    {role === "Vendor" && !delivery?.accepted_at && <form onSubmit={submit} className="mt-3 space-y-2">
      <label className="block font-bold">What was delivered?
        <textarea required minLength={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2" rows={3} />
      </label>
      <label className="block font-bold">Delivery date
        <input required type="date" max={new Date().toISOString().slice(0, 10)} value={deliveredAt} onChange={(event) => setDeliveredAt(event.target.value)} className="mt-1 block rounded-lg border border-blue-200 bg-white p-2" />
      </label>
      <button disabled={busy} className="button-secondary text-xs">{busy ? "Saving…" : delivery ? "Update delivery report" : "Report delivery"}</button>
    </form>}
    {role === "Organizer" && delivery && !delivery.accepted_at && <form onSubmit={submit} className="mt-3 space-y-2">
      <label className="block font-bold">Remaining issue, if any
        <textarea maxLength={5000} value={remainingIssue} onChange={(event) => setRemainingIssue(event.target.value)} placeholder="Leave blank if the work is complete" className="mt-1 w-full rounded-lg border border-blue-200 bg-white p-2" rows={2} />
      </label>
      <button disabled={busy} className="button-secondary text-xs">{busy ? "Saving…" : "Accept delivery"}</button>
    </form>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </div>;
}
