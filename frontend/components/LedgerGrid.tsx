"use client";

import { useMemo, useState, lazy, Suspense } from "react";
import { compareLedgerDate, publicLedgerEntries } from "@/lib/ledger-filters";
import type { ColDef } from "ag-grid-community";
import type { LedgerEntry } from "@/lib/types";
import { api, USE_MOCKS } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

// Keep the interactive grid in a separate chunk.
const AgGridPanel = lazy(() => import("./LedgerAgGrid"));

export default function LedgerGrid({ campaignId, entries }: { campaignId: number; entries: LedgerEntry[] }) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [simpleView, setSimpleView] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitted = question.trim();
    if (!submitted || asking || USE_MOCKS) return;
    setAsking(true);
    setAnswer("");
    setAskError("");
    try {
      const result = await api.askLedger(campaignId, submitted);
      setAnswer(result.answer);
    } catch (cause) {
      setAskError(cause instanceof Error ? cause.message : "Could not answer that question.");
    } finally {
      setAsking(false);
    }
  }

  const publicEntries = publicLedgerEntries(entries);
  const filtered = publicEntries.filter((entry) => (!type || entry.type === type) && `${entry.public_reference || ""} ${entry.actor_name} ${entry.type} ${entry.status} ${entry.detail ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const columns = useMemo<ColDef<LedgerEntry>[]>(() => [
    { field: "created_at", headerName: "Date", filter: "agDateColumnFilter", filterParams: { comparator: compareLedgerDate, buttons: ["reset", "apply"], closeOnApply: true, maxNumConditions: 1 }, valueFormatter: ({ value }) => value ? new Date(value as string).toLocaleDateString() : "", minWidth: 130 },
    { field: "type", headerName: "Type", minWidth: 110 },
    { field: "public_reference", headerName: "Public reference", minWidth: 190 },
    { field: "actor_name", headerName: "From / to", minWidth: 170 },
    { field: "amount", headerName: "Amount (USD)", filter: "agNumberColumnFilter", valueGetter: ({ data }) => data ? Number(data.amount) : null, valueFormatter: ({ value }) => `$${Number(value).toFixed(2)}`, minWidth: 130 },
    { field: "status", headerName: "Status", valueGetter: ({ data }) => data ? `${data.status}${data.source === "simulated" ? " · SIMULATED" : ""}` : "", minWidth: 160 },
    { field: "detail", headerName: "Details", minWidth: 260, flex: 1 },
    { field: "proof_url", headerName: "Proof", filterValueGetter: ({ data }) => data?.proof_url ? "Available" : "No proof", cellRenderer: ({ value }: { value: string | null }) => { const url = api.assetUrl(value); return url ? <a className="font-medium text-brand-700 underline" href={url} target="_blank" rel="noreferrer">View proof</a> : <span className="text-slate-400">—</span>; }, minWidth: 120 },
  ], []);

  return <div className="ledger-panel space-y-4">
    <div className="ledger-toolbar">
      <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wider text-slate-500">
        Search ledger
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by name, status, or type..."
          className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#001435] transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
        />
      </label>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
        Entry type
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="mt-1.5 block rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#001435] transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
        >
          <option value="">All entries</option>
          <option value="donation">Donations</option>
          <option value="payout">Payouts</option>
          <option value="refund">Refunds</option>
          <option value="dispute">Disputes</option>
          {publicEntries.some((e)=>e.type === "delivery") && <option value="delivery">Deliveries</option>}
          {publicEntries.some((e)=>e.type === "campaign") && <option value="campaign">Campaign updates</option>}
        </select>
      </label>
      <button
        type="button"
        aria-pressed={!simpleView}
        onClick={() => {
          const next = !simpleView;
          setSimpleView(next);
        }}
        className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#0070BA] hover:bg-slate-50"
      >
        {simpleView ? "Interactive grid" : "Simple table"}
      </button>
    </div>
    <p role="status" className="ledger-total text-xs font-semibold text-slate-500">
      Showing {filtered.length} of {publicEntries.length} recorded transactions
    </p>
    {simpleView && (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" role="region" aria-label="Ledger table, scroll horizontally for more columns" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Public donation and vendor payout records</caption>
          <thead className="border-b border-slate-200 bg-[#F0F7FD] text-xs font-bold uppercase tracking-wider text-[#003087]">
            <tr>{["Date", "Type", "Public reference", "From / to", "Amount (USD)", "Status", "Details", "Proof"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((entry, index) => (
              <tr key={index} className="transition hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold capitalize text-slate-800">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${entry.type === "donation" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {entry.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{entry.public_reference || "—"}</td>
                <td className="px-4 py-3 font-bold text-[#001435]">{entry.actor_name}</td>
                <td className="px-4 py-3 font-extrabold tabular-nums text-[#001435]">${entry.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-700">{entry.status}</span>
                  {entry.source === "simulated" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">SIMULATED</span>}
                </td>
                <td className="max-w-xs px-4 py-3 text-xs text-slate-600">{entry.detail ?? "—"}</td>
                <td className="px-4 py-3">
                  {api.assetUrl(entry.proof_url) ? (
                    <a href={api.assetUrl(entry.proof_url)!} target="_blank" rel="noreferrer" className="font-bold text-[#0070BA] underline hover:text-[#003087]" aria-label={`View proof for ${entry.actor_name} (opens in new tab)`}>
                      View proof
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-sm text-slate-500">No matching transactions found.</p>}
      </div>
    )}
    {(
      // Keep the grid mounted so filtering and sorting survive view changes.
      <div style={{ display: simpleView ? "none" : undefined }}>
          <Suspense fallback={
            <div className="flex h-[430px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <p className="text-sm text-slate-500">Loading interactive grid…</p>
            </div>
          }>
            <AgGridPanel filtered={filtered} columns={columns} isDark={isDark} />
          </Suspense>
      </div>
    )}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#001c48]" aria-labelledby="ledger-ask-title">
      <h2 id="ledger-ask-title" className="text-lg font-bold text-[#001435] dark:text-white">Ask the ledger</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Ask about recorded donations and confirmed vendor payouts in this campaign.</p>
      <form onSubmit={handleAsk} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
          Your question
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="Which vendor got paid the most?"
            disabled={asking || USE_MOCKS}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-[#001435] focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20 disabled:opacity-60"
          />
        </label>
        <button type="submit" disabled={!question.trim() || asking || USE_MOCKS} className="rounded-full bg-[#003087] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#00457C] disabled:cursor-not-allowed disabled:opacity-50">
          {asking ? "Finding answer…" : "Ask"}
        </button>
      </form>
      {USE_MOCKS && <p className="mt-3 text-xs text-slate-500">Questions are available with the live API.</p>}
      <div aria-live="polite" aria-atomic="true" className="mt-4 text-sm">
        {asking && <p className="text-slate-500">Reading the ledger…</p>}
        {answer && <p className="rounded-xl bg-[#F0F7FD] p-4 leading-relaxed text-[#001435] dark:bg-[#002b62] dark:text-white">{answer}</p>}
        {askError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{askError}</p>}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Answers summarize the public ledger. Check the transactions above for the source records.</p>
    </section>
  </div>;
}
