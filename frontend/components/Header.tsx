"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemoSession, signOutDemo } from "@/lib/demo-session";
import { demoRoles } from "@/lib/demo-state";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useDemoSession();
  const dashboard = demoRoles.find((role) => role.name === session?.role)?.path ?? "/signin";
  return <header className="site-header">
    <div className="page-width flex flex-wrap items-center justify-between gap-4 py-4">
      <Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight" aria-label="StraightMoney home"><span className="logo-mark" aria-hidden="true">s<span>.</span></span>StraightMoney</Link>
      <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-3 text-sm font-semibold sm:gap-5">
        <Link href="/#campaigns" className="nav-link">Explore campaigns</Link>
        <Link href="/#how-it-works" className="nav-link">How it works</Link>
        {session ? <details className="account-menu"><summary className="cursor-pointer rounded-lg px-3 py-2"><span className="block">{session.name}</span><span className="text-xs font-normal text-slate-600">{session.role}</span></summary><div className="account-popover"><Link href={dashboard} className="block rounded-lg px-3 py-3 hover:bg-brand-50">My dashboard</Link><button type="button" className="w-full rounded-lg px-3 py-3 text-left hover:bg-brand-50" onClick={() => { signOutDemo(); router.push("/"); }}>Sign out</button></div></details> : <Link href="/signin" aria-current={pathname === "/signin" ? "page" : undefined} className="nav-link">Sign in</Link>}
        <Link href={/^\/campaigns\/\d+$/.test(pathname) ? `${pathname}#donate` : "/donate"} className="button-primary">Donate</Link>
      </nav>
    </div>
  </header>;
}
