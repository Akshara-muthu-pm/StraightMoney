import Link from "next/link";
import Image from "next/image";

const steps = [
  { phase: "Plan", title: "A plan before the contribution", text: "Published budget lines show what the campaign needs and which vendors are assigned to the work.", path: "M5 4h14v17H5z M9 4V2h6v2 M8 9h8 M8 13h8 M8 17h5" },
  { phase: "Review", title: "Evidence behind the spending", text: "Vendors submit invoices and delivery evidence. Policy checks support a human review before eligible payouts.", path: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6" },
  { phase: "Pay", title: "Payments to the people doing the work", text: "Approved payouts are routed to registered vendor accounts, with paid and outstanding amounts tracked separately.", path: "M3 5h18v14H3z M3 9h18 M7 14h4 M15 14h2" },
  { phase: "Follow", title: "A record everyone can follow", text: "The public ledger connects donation records and confirmed vendor payouts, with evidence links where available.", path: "M4 4h16v17H4z M8 8h8 M8 12h8 M8 16h5" },
];

export default function OurIdea() {
  return <section id="our-idea" className="section-space border-b border-slate-200" aria-labelledby="idea-title">
    <div className="idea-flow-intro">
      <div><p className="eyebrow">Our idea. Our purpose.</p><h2 id="idea-title" className="display-heading mt-4 text-4xl sm:text-5xl">Bring generosity<br />and <em className="text-brand-700">accountability</em><br />into the same story.</h2><p className="mt-6 max-w-lg text-base leading-8 text-slate-700">Our goal is to help communities fund meaningful projects while giving supporters a clear view of how the money is used.</p><p className="mt-4 max-w-lg text-base leading-8 text-slate-700">StraightMoney connects the campaign budget, invoice review, vendor payments, and public spending record in one place. The giving journey continues after checkout, through the work and the payments that follow.</p><Link href="#campaigns" className="button-primary mt-7">Find a project to follow</Link></div>
      <div className="idea-flow-photos">
        <figure className="surface-card relative overflow-hidden"><Image src="/images/idea-community.jpg" alt="Four people standing together at sunset" fill sizes="(max-width: 767px) 100vw, 45vw" className="object-cover" /><figcaption className="idea-flow-photo-caption">People coming together.</figcaption></figure>
        <figure className="surface-card relative overflow-hidden"><Image src="/images/idea-partnership.jpg" alt="Two people shaking hands in partnership" fill sizes="(max-width: 767px) 70vw, 30vw" className="object-cover" /><figcaption className="idea-flow-photo-caption">Partnership behind the progress.</figcaption></figure>
        <p className="text-xs text-slate-600">Illustrative community and partnership photography.</p>
      </div>
    </div>
    <div className="mt-12"><p className="eyebrow">One connected journey</p><h3 className="display-heading mt-3 text-3xl sm:text-4xl">What makes our approach different</h3>
      <ol className="idea-flow-grid mt-7" aria-label="From project planning to public spending records">{steps.map((step, index) => <li className="idea-flow-step" key={step.phase}><article className="surface-card idea-flow-card"><div className="idea-flow-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={step.path} /></svg></div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand-800">0{index + 1} / {step.phase}</p><h4 className="mt-3 text-lg font-bold leading-7 text-slate-900">{step.title}</h4><p className="mt-3 text-sm leading-7 text-slate-700">{step.text}</p></article>{index < steps.length - 1 && <span className="idea-flow-connector" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15m-5-5 5 5-5 5" /></svg></span>}</li>)}</ol>
    </div>
    <p className="mt-6 text-sm leading-7 text-slate-700"><strong className="font-semibold text-brand-900">The principle behind StraightMoney:</strong> make the plan visible, review the work, and keep the spending traceable.</p>
  </section>;
}
