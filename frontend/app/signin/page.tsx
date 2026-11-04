"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInDemo } from "@/lib/demo-session";
import { demoRoles, type DemoRole } from "@/lib/demo-state";

export default function SignInPage() {
  const router = useRouter();
  const [role, setRole] = useState<DemoRole>("Donor");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      signInDemo(role, name);
      router.push(demoRoles.find((item) => item.name === role)!.path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the demo workspace.");
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-width grid min-h-[80vh] items-center gap-10 py-10 lg:grid-cols-2">
      <section className="relative min-h-[480px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#001435] via-[#003087] to-[#00457C] text-white shadow-xl shadow-blue-950/20">
        <Image
          src="/images/community-event.jpg"
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          alt="A volunteer helping at a community event"
          className="object-cover opacity-35 mix-blend-overlay image-reveal"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001435] via-[#001435]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-[#FFC439]" />
            PayPal AI Hackathon
          </div>
          <h1 className="display-heading mt-5 text-4xl text-white sm:text-5xl">
            Choose your role.<br />
            <span className="text-[#BAE0FC]">See every dollar.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-blue-100">
            Contribute as a donor, invoice as a vendor, manage as an organizer, or approve payouts as a verifier.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-blue-200">
            <span>Direct PayPal Payouts</span> · <span>Zero Organiser Custody</span> · <span>Public Ledger</span>
          </div>
        </div>
      </section>

      <section className="liquid-glass p-8 sm:p-12 shadow-2xl shadow-blue-900/10" aria-labelledby="signin-title">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#003087] via-[#00457C] to-[#0079C1] p-1.5 shadow-md shadow-blue-900/20 ring-1 ring-white/50">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" className="-rotate-6 transform">
              <path d="M6 5.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2H10.5L8 30.5H3.5L6 5.5z" fill="#001C64" />
              <path d="M11 9.5h11c3.8 0 6.5 2.5 6 6.3-.9 5.4-4.6 7.2-8.8 7.2h-3.7L13 32.5H8.5L11 9.5z" fill="#009CDE" opacity="0.9" />
            </svg>
          </span>
          <p className="text-xs font-black uppercase tracking-widest text-[#003087]">Demo Workspace Access</p>
        </div>
        <h2 id="signin-title" className="mt-4 text-3xl font-extrabold tracking-tight text-[#001435] sm:text-4xl">
          Sign in to your role.
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          Select a role to inspect the flow from donation to verified vendor disbursement. This selects a demo role; it does not sign in to PayPal.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Display name <span className="font-normal text-slate-400">(optional)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              autoComplete="nickname"
              placeholder="e.g. Alex Chen"
              className="mt-1.5 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-3 text-sm font-semibold text-[#001435] shadow-sm backdrop-blur-md transition focus:border-[#0070BA] focus:outline-none focus:ring-2 focus:ring-[#0070BA]/20"
            />
          </label>

          <fieldset>
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Continue as
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {demoRoles.map((item) => (
                <label
                  key={item.name}
                  className={`role-card ${role === item.name ? "role-card-selected" : ""}`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="role"
                      value={item.name}
                      checked={role === item.name}
                      onChange={() => setRole(item.name)}
                      className="h-4 w-4 accent-[#003087]"
                    />
                    <strong className="text-sm font-bold text-[#001435]">{item.name}</strong>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-slate-600">{item.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="button-primary w-full text-sm font-extrabold shadow-lg shadow-blue-950/20 hover:scale-[1.01]" type="submit">
            Open {role.toLowerCase()} workspace &rarr;
          </button>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          <p className="text-center text-xs text-slate-500">
            Workspace selection creates a simulated session in your browser.
          </p>
        </form>
      </section>
    </main>
  );
}
