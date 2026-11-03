import type { Donation } from "./types";

export const demoRoles = [
  { name: "Donor", path: "/donor", description: "Discover projects, donate, follow updates, and view spending." },
  { name: "Organizer", path: "/organizer", description: "Create campaigns, define budgets, assign vendors, and monitor delivery." },
  { name: "Vendor", path: "/vendor", description: "View assigned work, upload invoices and proof, and track payments." },
  { name: "Verifier", path: "/verifier", description: "Review invoices and evidence, make decisions, and check payout status." },
] as const;
export type DemoRole = typeof demoRoles[number]["name"];
export type Receipt = Donation & { campaign_title: string; mode: "simulated" | "sandbox" };
export type DemoState = { name: string; role: DemoRole; followed: number[]; receipts: Receipt[] };

export function createDemoState(role: DemoRole, name: string): DemoState {
  return { role, name: name.trim().slice(0, 80) || `Guest ${role}`, followed: [], receipts: [] };
}
export function parseDemoState(raw: string): DemoState | null {
  try {
    const value = JSON.parse(raw) as DemoState;
    if (!value || !demoRoles.some((role) => role.name === value.role) || typeof value.name !== "string" || !Array.isArray(value.followed) || !value.followed.every(Number.isInteger) || !Array.isArray(value.receipts)) return null;
    if (!value.receipts.every((item) => item && typeof item.paypal_order_id === "string" && typeof item.amount === "number" && typeof item.campaign_title === "string" && typeof item.currency === "string" && typeof item.created_at === "string" && Number.isInteger(item.campaign_id) && ["simulated", "sandbox"].includes(item.mode))) return null;
    return value;
  } catch { return null; }
}
export function toggleFollow(state: DemoState, id: number): DemoState {
  return { ...state, followed: state.followed.includes(id) ? state.followed.filter((item) => item !== id) : [...state.followed, id] };
}
export function addReceipt(state: DemoState, donation: Donation, title: string, mode: Receipt["mode"]): DemoState {
  if (state.role !== "Donor" || donation.status !== "captured" || state.receipts.some((item) => item.paypal_order_id === donation.paypal_order_id)) return state;
  return { ...state, receipts: [...state.receipts, { ...donation, campaign_title: title, mode }] };
}
