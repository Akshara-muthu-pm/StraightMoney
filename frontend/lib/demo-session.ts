"use client";

import { useMemo, useSyncExternalStore } from "react";
import { addReceipt, createDemoState, parseDemoState, toggleFollow, type DemoRole, type DemoState, type Receipt } from "./demo-state";
import type { Donation } from "./types";

const key = "straightmoney-demo-v1";
const event = "straightmoney-demo-change";
function snapshot() { try { return window.sessionStorage.getItem(key) ?? ""; } catch { return ""; } }
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
function save(state: DemoState | null) {
  try { if (state) window.sessionStorage.setItem(key, JSON.stringify(state)); else window.sessionStorage.removeItem(key); }
  catch { throw new Error("Enable session storage to open the demo workspace. Public campaigns can still be browsed without signing in."); }
  window.dispatchEvent(new Event(event));
}
export function useDemoSession() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => parseDemoState(raw), [raw]);
}
export function signInDemo(role: DemoRole, name: string) { save(createDemoState(role, name)); }
export function signOutDemo() {
  save(null);
  try { window.sessionStorage.removeItem("straightmoney-verifier-key"); } catch { /* Storage may be unavailable. */ }
}
export function followCampaign(id: number) { const state = parseDemoState(snapshot()); if (state) save(toggleFollow(state, id)); }
export function recordReceipt(donation: Donation, title: string, mode: Receipt["mode"]) {
  if (donation.status !== "captured") return;
  const state = parseDemoState(snapshot()) ?? createDemoState("Donor", donation.donor_name);
  try { save(addReceipt(state, donation, title, mode)); }
  catch { /* A captured payment must not be reported as failed if browser storage is unavailable. */ }
}
