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
    try { signInDemo(role, name); router.push(demoRoles.find((item) => item.name === role)!.path); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the demo workspace."); }
  }
  return <main id="main-content" tabIndex={-1} className="page-width grid min-h-[80vh] items-center gap-10 py-10 lg:grid-cols-2">
    <section className="relative min-h-[480px] overflow-hidden rounded-[2rem] bg-brand-900 text-white">
      <Image src="/images/community-event.jpg" fill sizes="(max-width: 1024px) 100vw, 50vw" alt="A volunteer helping at a community event" className="object-cover image-reveal" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-12"><p className="eyebrow text-brand-100">A brighter corner of the community</p><h1 className="display-heading mt-4 text-5xl">There&apos;s a part<br />for you to play.</h1><p className="mt-4 max-w-md leading-7 text-white/90">Give, organize, deliver, or review. Your part helps a community project move forward.</p><p className="mt-6 text-xs text-white/80">Illustrative photo / not a project delivery record</p></div>
    </section>
    <section className="glass-panel rounded-[2rem] p-6 sm:p-10" aria-labelledby="signin-title"><p className="eyebrow">Welcome to StraightMoney</p><h2 id="signin-title" className="display-heading mt-3 text-4xl">Sign in to your purpose.</h2><p className="mt-3 text-sm leading-6 text-slate-600">Choose your workspace to get started. No password required.</p>
      <form onSubmit={submit} className="mt-6 space-y-5"><label className="block text-sm font-semibold">Display name <span className="font-normal text-slate-500">(optional)</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="nickname" placeholder="How should we greet you?" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        <fieldset><legend className="mb-3 text-sm font-semibold">Continue as</legend><div className="grid gap-3 sm:grid-cols-2">{demoRoles.map((item) => <label key={item.name} className={`role-card ${role === item.name ? "role-card-selected" : ""}`}><span className="flex items-center gap-2"><input type="radio" name="role" value={item.name} checked={role === item.name} onChange={() => setRole(item.name)} className="h-4 w-4" /><strong>{item.name}</strong></span><span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span></label>)}</div></fieldset>
        <button className="button-primary w-full" type="submit">Open {role.toLowerCase()} dashboard</button>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
        <p className="text-xs leading-6 text-slate-600">Workspace selection opens your current browser session. No account is created.</p>
      </form>
    </section>
  </main>;
}
