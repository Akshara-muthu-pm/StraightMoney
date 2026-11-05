"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

export type Account = Awaited<ReturnType<typeof api.currentAccount>>;
let snapshot: Account | null | undefined;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() { for (const listener of listeners) listener(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function getSnapshot() { return snapshot; }
function getServerSnapshot() { return undefined; }

export function setAccount(account: Account | null) { snapshot = account; emit(); }
export function loadAccount() {
  if (!pending) {
    pending = api.currentAccount().then(setAccount).catch(() => setAccount(null)).finally(() => { pending = null; });
  }
  return pending;
}
export function useAccount() {
  const account = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { if (snapshot === undefined) void loadAccount(); }, []);
  return account;
}
export async function signOutAccount() {
  try { await api.logout(); } finally { setAccount(null); }
}
