"use client";

import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { LedgerEntry } from "@/lib/types";
import { api } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function LedgerGrid({ entries }: { entries: LedgerEntry[] }) {
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [simpleView, setSimpleView] = useState(false);
  const filtered = entries.filter((entry) => (!type || entry.type === type) && `${entry.actor_name} ${entry.type} ${entry.status}`.toLowerCase().includes(query.trim().toLowerCase()));
  const columns = useMemo<ColDef<LedgerEntry>[]>(() => [
    { field: "created_at", headerName: "Date", valueFormatter: ({ value }) => value ? new Date(value as string).toLocaleDateString() : "", minWidth: 130 },
    { field: "type", headerName: "Type", minWidth: 110 },
    { field: "actor_name", headerName: "From / to", minWidth: 170 },
    { field: "amount", headerName: "Amount", valueFormatter: ({ value }) => `$${Number(value).toFixed(2)}`, minWidth: 130 },
    { field: "status", headerName: "Status", valueGetter: ({ data }) => data ? `${data.status}${data.source === "simulated" ? " · SIMULATED" : ""}` : "", minWidth: 160 },
    { field: "proof_url", headerName: "Proof", cellRenderer: ({ value }: { value: string | null }) => { const url = api.assetUrl(value); return url ? <a className="font-medium text-brand-700 underline" href={url} target="_blank" rel="noreferrer">View proof</a> : <span className="text-slate-400">—</span>; }, minWidth: 120 },
  ], []);

  const gridTheme = useMemo(() => {
    if (isDark) {
      return themeQuartz.withParams({
        accentColor: "#009CDE",
        backgroundColor: "#001435",
        headerBackgroundColor: "#001c48",
        foregroundColor: "#F5F8FC",
        borderColor: "rgba(255, 255, 255, 0.12)",
        headerTextColor: "#BAE0FC",
        fontFamily: "var(--font-jakarta), system-ui, -apple-system, sans-serif",
      });
    }
    return themeQuartz.withParams({
      accentColor: "#0070BA",
      backgroundColor: "#FFFFFF",
      headerBackgroundColor: "#F0F7FD",
      foregroundColor: "#001435",
      borderColor: "#E1E7EC",
      fontFamily: "var(--font-jakarta), system-ui, -apple-system, sans-serif",
    });
  }, [isDark]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
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
        </select>
      </label>
      <button
        type="button"
        aria-pressed={simpleView}
        onClick={() => setSimpleView((value) => !value)}
        className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-[#0070BA] hover:bg-slate-50"
      >
        {simpleView ? "Interactive grid" : "Simple table"}
      </button>
    </div>
    <p role="status" className="text-xs font-semibold text-slate-500">
      Showing {filtered.length} of {entries.length} recorded transactions
    </p>
    {simpleView ? (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm" role="region" aria-label="Ledger table, scroll horizontally for more columns" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Public donation and vendor payout records</caption>
          <thead className="border-b border-slate-200 bg-[#F0F7FD] text-xs font-bold uppercase tracking-wider text-[#003087]">
            <tr>{["Date", "Type", "From / to", "Amount (USD)", "Status", "Proof"].map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3">{heading}</th>)}</tr>
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
                <td className="px-4 py-3 font-bold text-[#001435]">{entry.actor_name}</td>
                <td className="px-4 py-3 font-extrabold tabular-nums text-[#001435]">${entry.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-700">{entry.status}</span>
                  {entry.source === "simulated" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">SIMULATED</span>}
                </td>
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
    ) : (
      <div className="h-[430px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <AgGridReact
          onGridReady={({ api: gridApi }) => gridApi.setGridAriaProperty("label", "Public donation and payout ledger")}
          rowData={filtered}
          columnDefs={columns}
          defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1 }}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 20, 50]}
          theme={gridTheme}
        />
      </div>
    )}
  </div>;
}
