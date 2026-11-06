import Link from "next/link";
import Image from "next/image";

const highlights = [
  {
    title: "Know what you’re funding.",
    text: "Read the campaign budget before you give. See the supplies, services, and assigned vendors your contribution is intended to support.",
    label: "Give with clarity",
    image: "/images/impact-giving.jpg",
    alt: "Hands holding a small contribution and a note reading Make a change",
    details: ["Published budget lines", "Visible vendor assignments"],
  },
  {
    title: "See the work behind the request.",
    text: "Invoices and delivery evidence help a human verifier review the work before an eligible payout.",
    label: "Care behind each decision",
    image: "/images/impact-community.jpg",
    alt: "A group arranging their red-paint-covered hands in a circle",
    details: ["Invoice and policy checks", "Human review of evidence"],
  },
  {
    title: "Follow what happens next.",
    text: "Return for project updates and the public ledger. Submitted work and confirmed vendor payments are shown as separate milestones.",
    label: "Progress you can follow",
    image: "/images/impact-together.jpg",
    alt: "Two people reaching toward one another with open hands",
    details: ["Project progress updates", "Confirmed payout records"],
  },
];

export default function HomeHighlights() {
  return (
    <section id="our-impact" className="section-space impact-readable" aria-labelledby="impact-title">
      <div className="impact-introduction">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#003087]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA]" />
            Why your contribution matters
          </div>
          <h2 id="impact-title" className="mt-4 text-4xl font-extrabold tracking-tight text-[#001435] sm:text-5xl">
            Your kindness.<br />
            <span className="bg-gradient-to-r from-[#003087] to-[#0070BA] bg-clip-text text-transparent dark:from-[#BAE0FC] dark:to-white">
              A clearer path to impact.
            </span>
          </h2>
        </div>
        <p className="text-base leading-relaxed text-slate-600">
          Support a meaningful project, see the work being reviewed by Gemini AI, and follow the disbursements as they happen. Here&apos;s what that looks like on StraightMoney.
        </p>
      </div>

      <div className="impact-visual-grid mt-10">
        {highlights.map((item, index) => (
          <article key={item.label} className="impact-card liquid-glass overflow-hidden shadow-lg">
            <div className="impact-visual-photo relative overflow-hidden bg-brand-100">
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes={index === 0 ? "(max-width: 767px) 100vw, 55vw" : "(max-width: 767px) 100vw, 50vw"}
                className="object-cover"
              />
              <span className="impact-photo-number" aria-hidden="true">
                0{index + 1}
              </span>
            </div>
            <div className="impact-visual-copy">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#003087]">{item.label}</p>
                <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-[#001435]">{item.title}</h3>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">{item.text}</p>
                <ul className="mt-6 space-y-2.5">
                  {item.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                      <span className="impact-check" aria-hidden="true">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="m5 10 3 3 7-7" />
                        </svg>
                      </span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
              {index === 0 && (
                <div className="mt-8 border-t border-slate-100/80 pt-5">
                  <Link href="/explore" className="button-primary text-xs shadow-md shadow-blue-900/15">
                    Explore a campaign’s budget &rarr;
                  </Link>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-4 text-xs font-medium text-slate-600 dark:text-slate-300">Illustrative photographs of community giving and volunteer partnerships.</p>

      <div className="impact-summary mt-8">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#003087]">A purpose you can follow</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-[#001435]">A plan. Reviewed work. A visible record.</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Each campaign brings these pieces together in the campaign balance so you stay fully connected to the impact you create.
          </p>
        </div>
        <Link href="/explore" className="button-gold text-xs font-black shadow-md shadow-[#FFC439]/30 hover:scale-105 shrink-0">
          Find a project to support
        </Link>
      </div>
    </section>
  );
}
