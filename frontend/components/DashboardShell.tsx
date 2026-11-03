"use client";

import Link from "next/link";
import { useDemoSession } from "@/lib/demo-session";
import { demoRoles, type DemoRole } from "@/lib/demo-state";

export default function DashboardShell({ role, title, description, steps, children }: { role: DemoRole; title: string; description: string; steps: string[]; children: React.ReactNode }) {
  const session = useDemoSession();
  const path = demoRoles.find((item) => item.name === session?.role)?.path;
  return <main id="main-content" tabIndex={-1} className="page-width py-10">
    {!session || session.role !== role ? <section className="surface-card mx-auto max-w-xl p-8"><p className="eyebrow">{role} workspace</p><h1 className="display-heading mt-4 text-4xl">A place for your part in the project.</h1><p className="mt-4 leading-7 text-slate-600">Choose the {role.toLowerCase()} role on the sign-in page to explore this workspace.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/signin" className="button-primary">Choose your workspace</Link>{path && <Link href={path} className="button-secondary">My dashboard</Link>}<Link href="/#campaigns" className="button-secondary">Browse campaigns</Link></div></section> : <>
      <section className="mb-8 border-b border-slate-200 pb-8"><div className="flex flex-wrap items-center justify-between gap-4"><p className="eyebrow">{role} workspace</p><Link href="/#campaigns" className="text-sm font-semibold text-brand-800 underline underline-offset-4">Explore campaigns</Link></div><h1 className="display-heading mt-4 text-4xl sm:text-5xl">{title}</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">Welcome, {session.name}. {description}</p><ol className="mt-6 flex flex-wrap gap-4">{steps.map((step, index) => <li key={step} className="flex items-center gap-2 text-xs font-semibold"><span className="step-dot">{index + 1}</span>{step}</li>)}</ol></section>
      {children}
    </>}
  </main>;
}
