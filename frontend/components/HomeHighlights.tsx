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
  return <section id="our-impact" className="section-space impact-readable" aria-labelledby="impact-title">
    <div className="impact-introduction"><div><p className="eyebrow">Why your contribution matters</p><h2 id="impact-title" className="display-heading mt-4 text-4xl sm:text-5xl">Your kindness.<br /><span className="impact-highlight">A clearer path to impact.</span></h2></div><p className="text-base leading-8 text-slate-700">Support a meaningful project, see the work being reviewed, and follow the spending as it happens. Here’s what that looks like on StraightMoney.</p></div>
    <div className="impact-visual-grid mt-9">{highlights.map((item, index) => <article key={item.label} className="impact-card surface-card overflow-hidden"><div className="impact-visual-photo relative overflow-hidden bg-brand-100"><Image src={item.image} alt={item.alt} fill sizes={index === 0 ? "(max-width: 767px) 100vw, 55vw" : "(max-width: 767px) 100vw, 50vw"} className="object-cover" /><span className="impact-photo-number" aria-hidden="true">0{index + 1}</span></div><div className="impact-visual-copy"><p className="text-xs font-bold uppercase tracking-widest text-brand-800">{item.label}</p><h3 className="impact-clear-title mt-4">{item.title}</h3><p className="mt-4 text-base leading-8 text-slate-700">{item.text}</p><ul className="mt-6 space-y-3">{item.details.map((detail) => <li key={detail} className="flex items-center gap-3 text-sm font-semibold text-slate-800"><span className="impact-check" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 10 3 3 7-7" /></svg></span>{detail}</li>)}</ul>{index === 0 && <Link href="#campaigns" className="button-primary mt-7">Explore a campaign’s budget</Link>}</div></article>)}</div>
    <p className="mt-4 text-xs text-slate-600">Illustrative photographs of giving and community connection.</p>
    <div className="impact-summary mt-7"><div><p className="eyebrow">A purpose you can follow</p><h3 className="impact-clear-title mt-3">A plan. Reviewed work. A visible record.</h3><p className="mt-3 text-base leading-8 text-slate-700">Each campaign brings these pieces together so you can stay connected to the project you support.</p></div><Link href="#campaigns" className="button-primary shrink-0">Find a project to support</Link></div>
  </section>;
}
