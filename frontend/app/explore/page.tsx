import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Explore Campaigns | StraightMoney",
  description: "Explore public causes and startup projects on StraightMoney.",
};

const paths = [
  {
    href: "/explore/public-causes",
    title: "Public causes",
    description: "Support community projects with published budgets and spending records.",
    image: "/images/community-volunteers.jpg",
    imageAlt: "Volunteers working together on a community project",
    action: "Browse causes",
  },
  {
    href: "/explore/startups",
    title: "Startups",
    description: "Explore ventures funded through supplier milestones.",
    image: "/images/hero-planning.jpg",
    imageAlt: "Founders planning a project together",
    action: "Explore startups",
  },
];

export default function ExploreGatewayPage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-width py-10 sm:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="display-heading text-4xl text-[#001435] dark:text-white sm:text-5xl">Explore campaigns</h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">Choose what you want to support.</p>
      </header>

      <section className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2" aria-label="Campaign types">
        {paths.map((path) => (
          <article key={path.href} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
            <Link href={path.href} className="block">
              <div className="relative h-52 bg-slate-100 sm:h-60">
                <Image src={path.image} alt={path.imageAlt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition group-hover:scale-105" />
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold text-[#001435] dark:text-white">{path.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{path.description}</p>
                <span className="mt-6 inline-block text-sm font-bold text-[#003087] dark:text-sky-300">{path.action} &rarr;</span>
              </div>
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
