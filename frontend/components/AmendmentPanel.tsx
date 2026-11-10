"use client";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { Campaign, CampaignAmendment } from "@/lib/types";

export default function AmendmentPanel({ campaignId, campaign, mode, onChanged }: {campaignId: number; campaign?: Campaign; mode: "organizer" | "verifier" | "public"; onChanged?: () => void}) {
  const [items, setItems] = useState<CampaignAmendment[]>([]);
  const [goal, setGoal] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; api.amendments(campaignId).then((rows) => {if (active) {setItems(rows); setError("");}}).catch((e: unknown) => {if (active) setError(e instanceof Error ? e.message : "Could not load amendments.");}); return () => {active = false;}; }, [campaignId, revision]);
  async function propose(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.proposeAmendment(campaignId, {note: reason.trim(), ...(goal ? {goal_amount: Number(goal)} : {}), ...(beneficiary.trim() ? {beneficiary: beneficiary.trim()} : {}), ...(deliverables.trim() ? {expected_deliverables: deliverables.trim()} : {}), vendor_assignments: assignments}); setGoal(""); setBeneficiary(""); setDeliverables(""); setAssignments({}); setReason(""); setRevision((x) => x+1); } catch(e) {setError(e instanceof Error ? e.message : "Could not request amendment.");} finally {setBusy(false);}
  }
  async function decide(id: number, action: "approve" | "reject") {
    setBusy(true); setError("");
    try {await api.decideAmendment(id, action, notes[id]?.trim() || ""); setRevision((x) => x+1); onChanged?.();} catch(e) {setError(e instanceof Error ? e.message : "Could not review amendment.");} finally {setBusy(false);}
  }
  const field = "mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white";
  return <section className="liquid-glass my-6 space-y-4 p-5 text-sm text-slate-800 dark:text-slate-100"><h3 className="text-lg font-extrabold">Campaign amendments</h3><p className="text-xs">Changes are recorded and require an independent verifier’s approval. Existing campaign terms stay in effect until approval.</p>
    {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-950 dark:bg-red-950 dark:text-red-100">{error}<button type="button" className="ml-3 underline" onClick={() => setRevision((x) => x+1)}>Retry</button></p>}
    {items.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No amendments recorded.</p>}
    {items.map((item) => <article className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700" key={item.id}><p className="font-bold">Amendment #{item.id} · {item.status}</p><p>{item.reason}</p><dl className="text-xs">{item.proposed.goal_amount !== undefined && <div>Proposed target: {item.proposed.goal_amount}</div>}{item.proposed.beneficiary && <div>Beneficiary: {item.proposed.beneficiary}</div>}{item.proposed.expected_deliverables && <div>Deliverables: {item.proposed.expected_deliverables}</div>}{Object.entries(item.proposed.vendor_assignments || {}).map(([lineId, vendorId]) => <div key={lineId}>Assignment: {campaign?.budget_lines.find((l) => l.id === Number(lineId))?.name || `budget line ${lineId}`} → {campaign?.vendors.find((v) => v.id === vendorId)?.name || `vendor ${vendorId}`}</div>)}</dl>{item.review_note && <p className="text-xs">{item.reviewer_name}: {item.review_note}</p>}<time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</time>
      {mode === "verifier" && item.status === "pending" && <div><label className="block text-xs font-bold">Review reason<textarea value={notes[item.id] || ""} onChange={(e) => setNotes({...notes, [item.id]: e.target.value})} maxLength={5000} className={field} /></label><div className="mt-2 flex gap-2"><button disabled={busy || (notes[item.id]?.trim().length || 0) < 5} onClick={() => void decide(item.id, "approve")} className="button-primary text-xs">Approve amendment</button><button disabled={busy || (notes[item.id]?.trim().length || 0) < 5} onClick={() => void decide(item.id, "reject")} className="button-secondary text-xs">Reject amendment</button></div></div>}
    </article>)}
    {mode === "organizer" && campaign?.status === "active" && <details><summary className="cursor-pointer font-bold">Request a change</summary><form onSubmit={propose} className="mt-4 grid gap-4 sm:grid-cols-2"><label>New target ({campaign.currency})<input type="number" min="0.01" step="0.01" value={goal} onChange={(e) => setGoal(e.target.value)} className={field} /></label><label>Beneficiary<input maxLength={2000} value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className={field}/></label><label className="sm:col-span-2">Expected deliverables<textarea maxLength={5000} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className={field} /></label>{campaign.budget_lines.map((line) => <label key={line.id}>Vendor for {line.name}<select className={field} value={assignments[String(line.id)] ?? ""} onChange={(e) => {const next = {...assignments}; if (e.target.value) next[String(line.id)] = Number(e.target.value); else delete next[String(line.id)]; setAssignments(next);}}><option value="">Keep current assignment</option>{campaign.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>)}<label className="sm:col-span-2">Reason for change<textarea required minLength={5} maxLength={5000} value={reason} onChange={(e) => setReason(e.target.value)} className={field} /></label><p className="text-xs sm:col-span-2">Leave unchanged fields blank. A vendor cannot be reassigned once that budget line has invoice submissions.</p><button disabled={busy || items.some((i) => i.status === "pending")} className="button-primary text-xs">Submit amendment for review</button></form></details>}
  </section>;
}
