"use client";

import Link from "next/link";
import { useDemoSession } from "@/lib/demo-session";
import { demoRoles, type DemoRole } from "@/lib/demo-state";

export default function DashboardShell({
  role,
  title,
  description,
  steps,
  children,
}: {
  role: DemoRole;
  title: string;
  description: string;
  steps: string[];
  children: React.ReactNode;
}) {
  const session = useDemoSession();
  const path = demoRoles.find((item) => item.name === session?.role)?.path;

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-12">
      {!session || session.role !== role ? (
        <section className="liquid-glass mx-auto max-w-xl p-8 sm:p-12 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0079C1] p-1.5 shadow-md shadow-blue-900/20 ring-1 ring-white/50">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
                <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
                <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
              </svg>
            </span>
            <p className="text-xs font-black uppercase tracking-widest text-[#003087]">{role} Workspace</p>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#001435] sm:text-4xl">Choose a demo role</h1>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Please switch to the <strong className="text-[#001435]">{role}</strong> role on the demo sign-in page to access this workspace and its tools.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signin" className="button-primary text-xs shadow-md shadow-blue-900/15">
              Switch workspace &rarr;
            </Link>
            {path && (
              <Link href={path} className="button-secondary text-xs">
                My dashboard
              </Link>
            )}
            <Link href="/#campaigns" className="button-light text-xs">
              Browse campaigns
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="mb-10 border-b border-slate-200/70 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-3.5 py-1 text-xs font-black tracking-wider text-[#003087] backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-[#0070BA] animate-pulse" />
                {role.toUpperCase()} WORKSPACE
              </div>
              <Link href="/#campaigns" className="text-xs font-bold text-[#0070BA] hover:text-[#003087] underline underline-offset-4">
                Explore campaigns &rarr;
              </Link>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl text-[#001435]">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Welcome, <strong className="text-[#001435]">{session.name}</strong>. {description}
            </p>
            <ol className="mt-7 flex flex-wrap gap-2.5" aria-label="Workflow progress steps">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-2.5 rounded-full border border-white/80 bg-white/70 px-4 py-1.5 text-xs font-bold text-slate-700 backdrop-blur-md shadow-sm"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#003087] text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
          {children}
        </>
      )}
    </main>
  );
}
