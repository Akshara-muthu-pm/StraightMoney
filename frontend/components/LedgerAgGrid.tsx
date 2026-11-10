"use client";

/**
 * LedgerAgGrid — the ag-Grid interactive panel, lazily loaded.
 *
 * Splitting this into its own file means the ~500 kB ag-Grid bundle is only
 * fetched separately from the rest of the page.
 */

import { useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
} from "ag-grid-community";
import type { LedgerEntry } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  filtered: LedgerEntry[];
  columns: ColDef<LedgerEntry>[];
  isDark: boolean;
}

export default function LedgerAgGrid({ filtered, columns, isDark }: Props) {
  const api = useRef<GridApi<LedgerEntry> | null>(null);
  const [activeFilters, setActiveFilters] = useState(0);
  const [visibleRows, setVisibleRows] = useState<number | null>(null);
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

  return (
    <div className="ledger-interactive">
      <div className="ledger-filter-summary">
        <p role="status">{visibleRows ?? filtered.length} matching transactions · {activeFilters} column {activeFilters === 1 ? "filter" : "filters"}</p>
        <button type="button" disabled={!activeFilters} onClick={() => api.current?.setFilterModel(null)}>Clear column filters</button>
      </div>
      <div className="ledger-ag-grid h-[430px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <AgGridReact
        onGridReady={({ api: gridApi }) => {
          api.current = gridApi;
          gridApi.setGridAriaProperty("label", "Public donation and payout ledger");
        }}
        onModelUpdated={({ api: gridApi }) => setVisibleRows(gridApi.getDisplayedRowCount())}
        onFilterChanged={({ api: gridApi }) => setActiveFilters(Object.keys(gridApi.getFilterModel()).length)}
        rowData={filtered}
        columnDefs={columns}
        defaultColDef={{
          sortable: true,
          filter: "agTextColumnFilter",
          filterParams: { maxNumConditions: 1, defaultJoinOperator: "AND", buttons: ["reset", "apply"], closeOnApply: true, trimInput: true },
          resizable: true, flex: 1, minWidth: 130,
        }}
        overlayNoRowsTemplate='<span role="status">No matching transactions. Try changing or clearing your filters.</span>'
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 20, 50]}
        theme={gridTheme}
      />
      </div>
    </div>
  );
}
