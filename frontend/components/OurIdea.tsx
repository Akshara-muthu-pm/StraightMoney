import Link from "next/link";
import Image from "next/image";

const steps = [
  { phase: "Plan", title: "A plan before the contribution", text: "Published budget lines show what the campaign needs and which vendors are assigned to the work.", path: "M5 4h14v17H5z M9 4V2h6v2 M8 9h8 M8 13h8 M8 17h5" },
  { phase: "Review", title: "Evidence behind the spending", text: "Vendors submit invoices and delivery evidence. Policy checks support a human review before eligible payouts.", path: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6" },
  { phase: "Pay", title: "Payments to the people doing the work", text: "Approved payouts are routed to registered vendor accounts, with paid and outstanding amounts tracked separately.", path: "M3 5h18v14H3z M3 9h18 M7 14h4 M15 14h2" },
  { phase: "Follow", title: "A record everyone can follow", text: "The public ledger connects donation records and confirmed vendor payouts, with evidence links where available.", path: "M4 4h16v17H4z M8 8h8 M8 12h8 M8 16h5" },
];

export default function OurIdea() {
  return (
    <section id="our-idea" className="section-space border-b border-slate-200/70" aria-labelledby="idea-title">
      <div className="idea-flow-intro">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#003087]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA]" />
            Our idea &middot; Our purpose
          </div>
          <h2 id="idea-title" className="mt-4 text-4xl font-extrabold tracking-tight text-[#001435] sm:text-5xl">
            Bring generosity<br />and <span className="bg-gradient-to-r from-[#003087] to-[#0070BA] bg-clip-text text-transparent">accountability</span><br />into the same story.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600">
            Our goal is to help communities fund meaningful projects while giving supporters an absolute guarantee that funds are only disbursed directly to verified vendors for completed work.
          </p>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-500">
            StraightMoney connects published budgets, invoice reviews, automated Gemini checks, and immutable public ledger records in one place. Organizers never take custody of cash.
          </p>
          <Link href="#campaigns" className="button-primary mt-8 shadow-md shadow-blue-900/15">
            Find a project to follow &rarr;
          </Link>
        </div>
        <div className="idea-flow-photos">
          <figure className="liquid-glass relative overflow-hidden shadow-lg">
            <Image src="/images/idea-community.jpg" alt="Four people standing together at sunset" fill sizes="(max-width: 767px) 100vw, 45vw" className="object-cover" />
            <figcaption className="idea-flow-photo-caption">People coming together.</figcaption>
          </figure>
          <figure className="liquid-glass relative overflow-hidden shadow-xl">
            <Image src="/images/idea-partnership.jpg" alt="Two people shaking hands in partnership" fill sizes="(max-width: 767px) 70vw, 30vw" className="object-cover" />
            <figcaption className="idea-flow-photo-caption">Partnership behind the progress.</figcaption>
          </figure>
          <p className="text-[11px] text-slate-400">Illustrative community and partnership photography.</p>
        </div>
      </div>

      <div className="mt-16">
        <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#003087]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#009CDE]" />
          One connected journey
        </div>
        <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-[#001435] sm:text-4xl">
          What makes our approach different
        </h3>
        <ol className="idea-flow-grid mt-8" aria-label="From project planning to public spending records">
          {steps.map((step, index) => (
            <li className="idea-flow-step" key={step.phase}>
              <article className="liquid-glass idea-flow-card">
                <div className="idea-flow-symbol" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d={step.path} />
                  </svg>
                </div>
                <p className="mt-5 text-[11px] font-black uppercase tracking-widest text-[#003087]">
                  0{index + 1} / {step.phase}
                </p>
                <h4 className="mt-2.5 text-base font-extrabold leading-snug text-[#001435]">{step.title}</h4>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{step.text}</p>
              </article>
              {index < steps.length - 1 && (
                <span className="idea-flow-connector" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12h15m-5-5 5 5-5 5" />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 rounded-2xl border border-blue-200/80 bg-blue-50/60 p-4 backdrop-blur-md text-xs leading-relaxed text-[#003087]">
        <strong className="font-extrabold">The core StraightMoney guarantee:</strong> Make the plan public before checkout, review vendor delivery evidence with Gemini AI, and disburse exclusively through PayPal Payouts.
      </div>
    </section>
  );
}
