"use client";

/**
 * LedgerAgGrid — the ag-Grid interactive panel, lazily loaded.
 *
 * Splitting this into its own file means the ~500 kB ag-Grid bundle is only
 * fetched when the user clicks "Interactive grid". The default simple-table
 * view has zero ag-Grid overhead.
 */

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import type { LedgerEntry } from "@/lib/types";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Props {
  filtered: LedgerEntry[];
  columns: ColDef<LedgerEntry>[];
  isDark: boolean;
}

export default function LedgerAgGrid({ filtered, columns, isDark }: Props) {
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
    <div className="h-[430px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <AgGridReact
        onGridReady={({ api: gridApi }) =>
          gridApi.setGridAriaProperty("label", "Public donation and payout ledger")
        }
        rowData={filtered}
        columnDefs={columns}
        defaultColDef={{ sortable: true, filter: true, resizable: true, flex: 1 }}
        pagination
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 20, 50]}
        theme={gridTheme}
      />
    </div>
  );
}
