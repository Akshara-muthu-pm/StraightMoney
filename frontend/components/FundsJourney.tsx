import Link from "next/link";

const steps = [
  { number: "01", role: "You, the donor", title: "Choose & contribute", text: "Read the story and support its budget through PayPal checkout.", detail: "Your captured donation joins the campaign pool.", icon: "M12 21 3.4 12.4a5.5 5.5 0 0 1 7.8-7.8L12 5.4l.8-.8a5.5 5.5 0 0 1 7.8 7.8L12 21Z" },
  { number: "02", role: "The assigned vendor", title: "Work & evidence", text: "The assigned vendor submits an invoice with delivery proof for policy checks.", detail: "The request is checked against the project’s budget and vendor assignment.", icon: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5" },
  { number: "03", role: "A human verifier", title: "Human review", text: "A verifier reviews the invoice, checks, and evidence before deciding.", detail: "The reviewer can approve or reject the invoice.", icon: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6" },
  { number: "04", role: "Payment confirmation", title: "Confirmed payout", text: "Approved invoices can await funds. Only confirmed payments count as paid.", detail: "Payments go directly to the vendor’s registered account and appear in the public ledger.", icon: "M3 5h18v14H3z M3 9h18 M7 14h3 M15 14l2 2 4-4" },
];

export default function FundsJourney() {
  return (
    <section id="how-it-works" className="section-space border-b border-slate-200/70" aria-labelledby="journey-title">
      <div className="funds-journey-layout">
        <div className="funds-journey-intro">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#003087]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA]" />
            Care in every step
          </div>
          <h2 id="journey-title" className="mt-4 text-4xl font-extrabold tracking-tight text-[#001435] sm:text-5xl">
            How funds reach<br />the people doing the work.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Your donation enters the campaign balance. Vendors submit invoices and delivery evidence against published budget lines. Python rules check policy and Gemini adds advisory flags, and a human verifier reviews the evidence before approved payouts disburse directly to vendor accounts.
          </p>
          <div className="funds-journey-principle mt-8 shadow-sm">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6" />
              </svg>
            </span>
            <p className="text-xs leading-relaxed text-[#003087]">
              A published budget.<br />
              <strong>A human checking the proof.</strong><br />
              An immutable ledger you can inspect.
            </p>
          </div>
          <Link href="#campaigns" className="button-secondary mt-8 shadow-sm text-xs">
            Follow a campaign’s journey &rarr;
          </Link>
        </div>

        <ol className="funds-timeline" aria-label="Four steps from donation to confirmed vendor payment">
          {steps.map((step) => (
            <li key={step.number} className="funds-timeline-step">
              <span className="funds-timeline-node" aria-hidden="true">
                {step.number}
              </span>
              <article className="liquid-glass funds-step-card shadow-md">
                <div className="funds-step-heading">
                  <span className="funds-step-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d={step.icon} />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#003087]">{step.role}</p>
                    <h3 className="mt-0.5 text-lg font-extrabold text-[#001435]">{step.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{step.text}</p>
                <p className="mt-3 border-t border-slate-100/80 pt-3 text-[11px] leading-relaxed text-slate-500 font-medium">{step.detail}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>

      <aside className="funds-payment-note mt-12" aria-labelledby="approval-payment-title">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#003087]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA]" />
            Two Separate Milestones
          </div>
          <h3 id="approval-payment-title" className="mt-2 text-xl font-extrabold text-[#001435]">
            Approval comes before payment.
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            An approved invoice may still be waiting for campaign funds or PayPal batch settlement. The record shows &ldquo;paid&rdquo; only after PayPal Payouts returns a verified SUCCESS response.
          </p>
        </div>
        <div className="funds-milestones">
          <span>
            <strong className="block text-sm font-black text-[#001435]">Approved</strong>
            <small>Review decision</small>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 12h15m-5-5 5 5-5 5" />
          </svg>
          <span className="border-emerald-200/80 bg-emerald-50/60">
            <strong className="block text-sm font-black text-emerald-900">Paid</strong>
            <small className="text-emerald-700/80">Confirmed transfer</small>
          </span>
        </div>
      </aside>
    </section>
  );
}
