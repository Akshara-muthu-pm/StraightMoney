import Link from "next/link";

const steps = [
  { number: "01", role: "Donor", title: "Contribute", text: "Support a published campaign budget through PayPal checkout.", icon: "M12 21 3.4 12.4a5.5 5.5 0 0 1 7.8-7.8L12 5.4l.8-.8a5.5 5.5 0 0 1 7.8 7.8L12 21Z" },
  { number: "02", role: "Vendor", title: "Submit evidence", text: "The assigned vendor submits an invoice and proof of delivery.", icon: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5" },
  { number: "03", role: "Verifier", title: "Review", text: "An independent verifier approves or rejects the request.", icon: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6" },
  { number: "04", role: "PayPal", title: "Pay vendor", text: "Confirmed vendor payouts appear in the public ledger.", icon: "M3 5h18v14H3z M3 9h18 M7 14h3 M15 14l2 2 4-4" },
];

export default function FundsJourney() {
  return (
    <section id="how-it-works" className="section-space border-b border-slate-200/70" aria-labelledby="journey-title">
      <div className="funds-journey-layout">
        <div className="funds-journey-intro">
          <h2 id="journey-title" className="text-3xl font-bold tracking-tight text-[#001435] sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Four clear steps connect each contribution to reviewed work and confirmed vendor payments.
          </p>
          <Link href="/explore" className="button-secondary mt-7 text-xs">
            Explore campaigns &rarr;
          </Link>
        </div>

        <ol className="funds-timeline" aria-label="Four steps from donation to confirmed vendor payment">
          {steps.map((step) => (
            <li key={step.number} className="funds-timeline-step">
              <span className="funds-timeline-node" aria-hidden="true">
                {step.number}
              </span>
              <article className="liquid-glass funds-step-card">
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
              </article>
            </li>
          ))}
        </ol>
      </div>

    </section>
  );
}
