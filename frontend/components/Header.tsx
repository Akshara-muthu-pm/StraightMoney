"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemoSession, signOutDemo } from "@/lib/demo-session";
import { demoRoles } from "@/lib/demo-state";
import { useTheme } from "@/components/ThemeProvider";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useDemoSession();
  const { resolvedTheme, toggleTheme } = useTheme();
  const mounted = useIsMounted();
  const dashboard = demoRoles.find((role) => role.name === session?.role)?.path ?? "/signin";

  return (
    <header className="site-header">
      <div className="page-width flex flex-wrap items-center justify-between gap-4 py-3.5">
        <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight group" aria-label="StraightMoney home">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0079C1] p-2 shadow-lg shadow-[#003087]/25 ring-1 ring-white/50 transition duration-300 group-hover:scale-105 group-hover:shadow-[#0070BA]/35" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform drop-shadow-sm">
              {/* Back P (Deep Navy) */}
              <path
                d="M7 4h10.5c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L9.5 28H5.2L7 4z"
                fill="#001C64"
              />
              {/* Front P (Cyan & Active Blue) */}
              <path
                d="M11.5 7.5H22c3.6 0 6.2 2.2 5.6 5.8-.8 4.8-4.2 6.4-7.8 6.4h-3.6L14 31.5H9.7l2.8-24z"
                fill="#009CDE"
              />
              {/* Overlapping intersection */}
              <path
                d="M11.5 7.5h6.2c3.6 0 6.2 2.2 5.6 5.8-.3 1.8-1 3.2-2.1 4.2-.8-1.5-2.2-2.2-4.2-2.2h-3.6l-1.1 5.9H9.7l1.8-13.7z"
                fill="#00457C"
                opacity="0.9"
              />
            </svg>
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold tracking-tight text-[#001435]">
              Straight<span className="text-[#0070BA]">Money</span>
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-blue-200/90 bg-gradient-to-r from-blue-50/95 to-sky-50/95 px-3 py-0.5 text-[10px] font-black tracking-wider text-[#003087] shadow-sm backdrop-blur-md sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] animate-pulse" />
              PAYPAL SANDBOX
            </span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:gap-3.5">
          <Link href="/explore" className="rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white/80 hover:text-[#003087] hover:shadow-sm">
            Explore campaigns
          </Link>
          <Link href="/#how-it-works" className="rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white/80 hover:text-[#003087] hover:shadow-sm">
            How it works
          </Link>
          {session ? (
            <details className="account-menu">
              <summary className="cursor-pointer flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 backdrop-blur-md shadow-sm transition hover:bg-white hover:border-blue-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003087] text-[10px] font-black text-white">
                  {session.name.charAt(0).toUpperCase()}
                </span>
                <span className="block text-xs font-extrabold text-[#001435]">{session.name}</span>
                <span className="rounded-full bg-[#E1F0FC] px-2 py-0.2 text-[10px] font-bold text-[#003087]">{session.role}</span>
              </summary>
              <div className="account-popover">
                <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                  WORKSPACE: <span className="text-[#003087] font-extrabold">{session.role}</span>
                </div>
                <Link href={dashboard} className="mt-1 block rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 transition hover:bg-blue-50 hover:text-[#003087]">
                  My dashboard &rarr;
                </Link>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => { signOutDemo(); router.push("/"); }}
                >
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <Link
              href="/signin"
              aria-current={pathname === "/signin" ? "page" : undefined}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white/80 hover:text-[#003087]"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn group relative flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/70 text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white hover:border-blue-200 hover:text-[#003087] hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0070BA]"
            aria-label={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
            title={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
          >
            {mounted && resolvedTheme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FFC439] transition-transform duration-300 group-hover:rotate-45">
                <circle cx="12" cy="12" r="4" fill="#FFC439" fillOpacity="0.2" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="M4.93 4.93l1.41 1.41" />
                <path d="M17.66 17.66l1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="M6.34 17.66l-1.41 1.41" />
                <path d="M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#003087] transition-transform duration-300 group-hover:-rotate-12">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" fill="#003087" fillOpacity="0.15" />
              </svg>
            )}
          </button>
          <Link
            href={/^\/campaigns\/\d+$/.test(pathname) ? `${pathname}#donate` : "/donate"}
            className="button-gold text-xs font-black shadow-md shadow-[#FFC439]/25 hover:shadow-[#FFC439]/40"
          >
            {/^\/campaigns\/\d+$/.test(pathname) ? "Donate" : "Choose a cause"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
