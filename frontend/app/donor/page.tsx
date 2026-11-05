"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useDemoSession } from "@/lib/demo-session";
import { api } from "@/lib/api";
import type { CampaignSummary, DonationStatus, DonorUpdate } from "@/lib/types";
import { money } from "@/lib/presentation";

export default function DonorPage() {
  return <DashboardShell role="Donor" title="Stay close to the good you start." description="Discover a project, make a contribution, and return here to follow the next chapter." steps={["Discover", "Read the story", "Donate", "Follow progress"]}><DonorContent /></DashboardShell>;
}
function DonorContent() {
  const session = useDemoSession();
  const orderIds = session?.receipts.map((receipt) => receipt.paypal_order_id).join(",") ?? "";
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [state, setState] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, DonationStatus>>({});
  const [updates, setUpdates] = useState<DonorUpdate[]>([]);
  const [updatesError, setUpdatesError] = useState(false);
  const [seenUpdates, setSeenUpdates] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved: unknown = JSON.parse(window.sessionStorage.getItem("straightmoney-seen-updates") || "[]");
      return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
    }
    catch { return []; }
  });
  useEffect(() => {
    let active = true;
    api.listCampaigns().then((items) => { if (active) { setCampaigns(items); setState("ready"); } }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    const receipts = session?.receipts ?? [];
    if (receipts.length === 0) return;
    let active = true;
    Promise.all(receipts.map(async (receipt) => {
      try { return [receipt.paypal_order_id, await api.donationStatus(receipt.paypal_order_id)] as const; }
      catch { return null; }
    })).then((results) => {
      if (active) setPaymentStatuses(Object.fromEntries(results.filter((item): item is NonNullable<typeof item> => item !== null)));
    });
    return () => { active = false; };
  }, [session?.receipts]);
  useEffect(() => {
    const ids = orderIds.split(",").filter(Boolean);
    if (ids.length === 0) return;
    let active = true;
    async function loadUpdates() {
      const results = await Promise.allSettled(ids.map((id) => api.donorUpdates(id)));
      if (!active) return;
      const unique = new Map<string, DonorUpdate>();
      for (const result of results) if (result.status === "fulfilled") {
        for (const update of result.value) unique.set(`${update.campaign_id}:${update.id}`, update);
      }
      setUpdates([...unique.values()].sort((a, b) => b.id - a.id));
      setUpdatesError(results.some((result) => result.status === "rejected"));
    }
    void loadUpdates();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void loadUpdates(); }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadUpdates(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [orderIds]);
  if (!session) return null;
  const supported = campaigns.filter((campaign) => session.followed.includes(campaign.id) || session.receipts.some((receipt) => receipt.campaign_id === campaign.id));
  const unread = updates.filter((update) => !seenUpdates.includes(`${update.campaign_id}:${update.id}`)).length;
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs font-medium text-slate-500">
          Follows and donation confirmations stay active in this session until you sign out.
        </p>
        <Link href="/explore" className="button-primary text-xs">
          Explore campaigns
        </Link>
      </div>

      {session.receipts.length > 0 && <section className="liquid-glass mb-10 p-6" aria-labelledby="donor-updates-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="donor-updates-heading" className="text-xl font-extrabold text-[#001435]">Campaign updates {unread > 0 && <span className="ml-2 rounded-full bg-[#003087] px-2 py-0.5 text-xs text-white">{unread} new</span>}</h2>
            <p className="mt-1 text-xs text-slate-600">Approval, payment, and delivery updates for campaigns you supported. This dashboard checks for new updates while it is open.</p>
          </div>
          {unread > 0 && <button type="button" className="button-secondary text-xs" onClick={() => {
            const keys = [...new Set([...seenUpdates, ...updates.map((update) => `${update.campaign_id}:${update.id}`)])];
            setSeenUpdates(keys);
            try { window.sessionStorage.setItem("straightmoney-seen-updates", JSON.stringify(keys)); } catch { /* Unread state remains available until reload. */ }
          }}>Mark all read</button>}
        </div>
        {updatesError && <p role="status" className="mt-4 text-xs text-amber-800">Updates are temporarily unavailable. Your public ledger is still available.</p>}
        {updates.length === 0 && !updatesError && <p className="mt-4 text-xs text-slate-500">No approval, payment, or delivery updates yet.</p>}
        {updates.length > 0 && <ul className="mt-4 divide-y divide-slate-200">
          {updates.map((update) => <li key={`${update.campaign_id}:${update.id}`} className="flex flex-wrap items-start justify-between gap-3 py-3 text-xs">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2"><strong className="text-sm text-[#001435]">{update.title}</strong>{!seenUpdates.includes(`${update.campaign_id}:${update.id}`) && <span className="h-2 w-2 rounded-full bg-[#0070BA]" aria-label="Unread" />}</div>
              <p className="mt-1 text-slate-600">{update.campaign_title} · {update.message}</p>
              <p className="mt-1 text-slate-500">{new Date(update.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-3 font-bold text-[#003087]"><Link href={`/campaigns/${update.campaign_id}`}>Campaign</Link><Link href={`/ledger/${update.campaign_id}`}>Ledger</Link>{api.assetUrl(update.proof_url) && <a href={api.assetUrl(update.proof_url)!} target="_blank" rel="noreferrer">Proof</a>}</div>
          </li>)}
        </ul>}
      </section>}

      <section aria-labelledby="supported-title">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0070BA]" />
          <h2 id="supported-title" className="text-2xl font-extrabold tracking-tight text-[#001435]">
            Supported &amp; followed campaigns
          </h2>
        </div>
        {state === "loading" && <p role="status" className="mt-5 text-xs text-slate-500">Loading campaigns...</p>}
        {state === "error" && (
          <div role="alert" className="liquid-glass mt-5 p-5">
            <p className="text-xs text-red-900">Campaigns are unavailable right now. Your confirmations below are still available.</p>
            <button className="button-secondary mt-3 text-xs" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>
              Try again
            </button>
          </div>
        )}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {supported.map((campaign) => (
            <article key={campaign.id} className="liquid-glass p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-0.5 text-[10px] font-bold text-[#003087]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA]" />
                {session.followed.includes(campaign.id) ? "Following" : "Supported"}
              </span>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-[#001435]">{campaign.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{campaign.description}</p>
              {campaign.cancelled_at && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Campaign cancelled: {campaign.cancellation_reason}. Check the public ledger for refunds and disputes.</p>}
              <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-[#003087]">
                <Link href={`/campaigns/${campaign.id}#updates`} className="underline hover:text-[#0070BA]">
                  Follow progress &rarr;
                </Link>
                <Link href={`/campaigns/${campaign.id}#donate`} className="underline hover:text-[#0070BA]">
                  Donate &rarr;
                </Link>
                <Link href={`/ledger/${campaign.id}`} className="underline hover:text-[#0070BA]">
                  View spending &rarr;
                </Link>
              </div>
            </article>
          ))}
        </div>
        {state === "ready" && supported.length === 0 && (
          <div className="liquid-glass mt-5 p-8 text-center sm:text-left">
            <h3 className="text-base font-extrabold text-[#001435]">Your next chapter starts with a project.</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Read a campaign story and select &ldquo;Follow this project&rdquo; to keep it here. Confirmed donations made in this session appear in your history below.
            </p>
            <Link href="/explore" className="button-primary mt-4 text-xs">
              Find a campaign
            </Link>
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="history-title">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#009CDE]" />
          <h2 id="history-title" className="text-2xl font-extrabold tracking-tight text-[#001435]">
            Donation history
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Confirmed PayPal Sandbox and test contributions from this session.
        </p>
        {session.receipts.length === 0 ? (
          <div className="liquid-glass mt-5 p-6 text-xs text-slate-500">
            No confirmed donations here yet. Mock checkout previews do not create donation records.
          </div>
        ) : (
          <ul className="mt-5 space-y-3.5">
            {session.receipts.map((receipt) => (
              <li key={receipt.paypal_order_id} className="liquid-glass flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-extrabold text-[#001435]">{receipt.campaign_title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(receipt.created_at).toLocaleDateString()} &middot;{" "}
                    <span className="font-bold text-[#0070BA]">
                      {receipt.mode === "simulated" ? "Simulated test donation" : "PayPal Sandbox capture"}
                    </span>
                  </p>
                  <Link href={`/ledger/${receipt.campaign_id}`} className="mt-2 inline-block text-xs font-bold text-[#003087] underline hover:text-[#0070BA]">
                    View campaign ledger &rarr;
                  </Link>
                  {paymentStatuses[receipt.paypal_order_id]?.adjustments.map((adjustment, index) => <p key={`${adjustment.kind}-${index}`} className="mt-2 text-xs font-semibold text-amber-900">
                    {adjustment.kind === "refund" ? "Refund" : "Dispute"}: {adjustment.status.replaceAll("_", " ")} · {money(adjustment.amount, receipt.currency)}
                  </p>)}
                </div>
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-right">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">{paymentStatuses[receipt.paypal_order_id]?.unavailable_amount ? "Captured · adjusted" : "Captured"}</span>
                  <strong className="text-lg font-black text-emerald-950 tabular-nums">{money(receipt.amount, receipt.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
