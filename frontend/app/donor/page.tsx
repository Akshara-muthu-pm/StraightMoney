"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useDemoSession } from "@/lib/demo-session";
import { api } from "@/lib/api";
import type { CampaignSummary } from "@/lib/types";
import { money } from "@/lib/presentation";

export default function DonorPage() {
  return <DashboardShell role="Donor" title="Stay close to the good you start." description="Discover a project, make a contribution, and return here to follow the next chapter." steps={["Discover", "Read the story", "Donate", "Follow progress"]}><DonorContent /></DashboardShell>;
}
function DonorContent() {
  const session = useDemoSession();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [state, setState] = useState("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api.listCampaigns().then((items) => { if (active) { setCampaigns(items); setState("ready"); } }).catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [retry]);
  if (!session) return null;
  const supported = campaigns.filter((campaign) => session.followed.includes(campaign.id) || session.receipts.some((receipt) => receipt.campaign_id === campaign.id));
  return <>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><p className="text-sm leading-7 text-slate-600">Follows and donation confirmations stay in this session until you sign out.</p><Link href="/#campaigns" className="button-primary">Explore campaigns</Link></div>
    <section aria-labelledby="supported-title"><h2 id="supported-title" className="display-heading text-3xl">Supported & followed campaigns</h2>{state === "loading" && <p role="status" className="mt-5">Loading campaigns...</p>}{state === "error" && <div role="alert" className="surface-card mt-5 p-5"><p>Campaigns are unavailable right now. Your confirmations below are still available.</p><button className="button-secondary mt-3" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>Try again</button></div>}<div className="mt-5 grid gap-5 md:grid-cols-2">{supported.map((campaign) => <article key={campaign.id} className="surface-card p-6"><p className="eyebrow">{session.followed.includes(campaign.id) ? "Following" : "Supported"}</p><h3 className="display-heading mt-3 text-3xl">{campaign.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{campaign.description}</p><div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-brand-800"><Link href={`/campaigns/${campaign.id}#updates`} className="underline">Follow progress</Link><Link href={`/campaigns/${campaign.id}#donate`} className="underline">Donate</Link><Link href={`/ledger/${campaign.id}`} className="underline">View spending</Link></div></article>)}</div>{state === "ready" && supported.length === 0 && <div className="surface-card mt-5 p-7"><h3 className="font-semibold">Your next chapter starts with a project.</h3><p className="mt-3 text-sm leading-7 text-slate-600">Read a campaign story and select “Follow this project” to keep it here. Confirmed donations made in this session appear in your history below.</p><Link href="/#campaigns" className="mt-4 inline-block font-semibold text-brand-800 underline">Find a campaign</Link></div>}</section>
    <section className="mt-10" aria-labelledby="history-title"><h2 id="history-title" className="display-heading text-3xl">Donation history</h2><p className="mt-3 text-sm text-slate-600">Donation confirmations from this browser session. Sign-out clears these records.</p>{session.receipts.length === 0 ? <p className="surface-card mt-5 p-6 text-sm text-slate-600">No confirmed donations here yet. Mock checkout previews do not create donation records.</p> : <ul className="mt-5 space-y-4">{session.receipts.map((receipt) => <li key={receipt.paypal_order_id} className="surface-card flex flex-wrap justify-between gap-4 p-6"><div><h3 className="font-semibold">{receipt.campaign_title}</h3><p className="mt-2 text-sm text-slate-600">{new Date(receipt.created_at).toLocaleDateString()} / {receipt.mode === "simulated" ? "Simulated donation" : "Sandbox donation"}</p><Link href={`/ledger/${receipt.campaign_id}`} className="mt-3 inline-block text-sm text-brand-800 underline">View campaign ledger</Link></div><strong>{money(receipt.amount, receipt.currency)}</strong></li>)}</ul>}</section>
  </>;
}
