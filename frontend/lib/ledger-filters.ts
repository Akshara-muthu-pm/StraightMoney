/** Compare the calendar day displayed in the ledger, ignoring time of day. */
export function compareLedgerDate(filterDate: Date, value: string | null | undefined): number {
  if (!value) return -1;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return -1;
  const day = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const filterDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()).getTime();
  return day < filterDay ? -1 : day > filterDay ? 1 : 0;
}

/** Public ledger records completed money movement, never checkout attempts. */
export function publicLedgerEntries<T extends { type: string; status: string }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.type !== "donation" || ["captured", "donated"].includes(entry.status.toLowerCase()))
    .map((entry) => entry.type === "donation" ? { ...entry, status: "Donated" } : entry.type === "payout" && entry.status === "success" ? {...entry, status: "Vendor paid"} : entry);
}
