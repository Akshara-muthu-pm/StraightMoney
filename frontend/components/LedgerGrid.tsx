"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { LedgerEntry } from "@/lib/types";
import { api } from "@/lib/api";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function LedgerGrid({ entries }: { entries: LedgerEntry[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [simpleView, setSimpleView] = useState(false);
  const filtered = entries.filter((entry) => (!type || entry.type === type) && `${entry.actor_name} ${entry.type} ${entry.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const columns = useMemo<ColDef<LedgerEntry>[]>(() => [
    { field: "created_at", headerName: "Date", valueFormatter: ({ value }) => value ? new Date(value as string).toLocaleDateString() : "", minWidth: 130 },
    { field: "type", headerName: "Type", minWidth: 110 },
    { field: "actor_name", headerName: "From / to", minWidth: 170 },
    { field: "amount", headerName: "Amount", valueFormatter: ({ value }) => `$${Number(value).toFixed(2)}`, minWidth: 130 },
    { field: "status", headerName: "Status", minWidth: 120 },
    { field: "proof_url", headerName: "Proof", cellRenderer: ({ value }: { value: string | null }) => { const url = api.assetUrl(value); return url ? <a className="font-medium text-brand-700 underline" href={url} target="_blank" rel="noreferrer">View proof</a> : <span className="text-slate-400">—</span>; }, minWidth: 120 },
  ], []);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-semibold">Search ledger<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or status" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
      <label className="text-sm font-semibold">Entry type<select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All entries</option><option value="donation">Donations</option><option value="payout">Payouts</option></select></label>
      <button type="button" aria-pressed={simpleView} onClick={() => setSimpleView((value) => !value)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">{simpleView ? "Use interactive grid" : "Use simple table"}</button>
    </div>
    <p role="status" className="text-sm text-slate-600">{filtered.length} of {entries.length} entries shown</p>
    {simpleView ? <div className="overflow-x-auto rounded-xl border border-slate-200" role="region" aria-label="Ledger table, scroll horizontally for more columns" tabIndex={0}><table className="w-full text-left text-sm"><caption className="sr-only">Public donation and vendor payout records</caption><thead className="bg-slate-100"><tr>{["Date", "Type", "From / to", "Amount (USD)", "Status", "Proof"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap p-3">{heading}</th>)}</tr></thead><tbody>{filtered.map((entry, index) => <tr key={index} className="border-t border-slate-200"><td className="whitespace-nowrap p-3">{new Date(entry.created_at).toLocaleDateString()}</td><td className="p-3">{entry.type}</td><td className="p-3">{entry.actor_name}</td><td className="p-3">${entry.amount.toFixed(2)}</td><td className="p-3">{entry.status}</td><td className="p-3">{api.assetUrl(entry.proof_url) ? <a href={api.assetUrl(entry.proof_url)!} target="_blank" rel="noreferrer" className="text-brand-800 underline" aria-label={`View proof for ${entry.actor_name} (opens in new tab)`}>View proof</a> : "No proof"}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="p-5 text-slate-600">No matching entries. Try another name or entry type.</p>}</div> : <div className="h-[430px] w-full"><AgGridReact onGridReady={({ api: gridApi }) => gridApi.setGridAriaProperty("label", "Public donation and payout ledger")} rowData={filtered} columnDefs={columns} defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1 }} pagination paginationPageSize={10} paginationPageSizeSelector={[10, 20, 50]} theme={themeQuartz.withParams({ accentColor: "var(--color-brand-700)", backgroundColor: "#fafcfd", headerBackgroundColor: "#e7eff5", foregroundColor: "#1c3247", borderColor: "#dce4ec", fontFamily: "var(--font-jakarta), Arial, sans-serif" })} /></div>}
  </div>;
}
