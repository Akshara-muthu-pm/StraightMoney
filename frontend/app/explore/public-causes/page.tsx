import Link from "next/link";
import CampaignExplore from "@/components/CampaignExplore";

export const metadata = {
  title: "Public Causes | StraightMoney",
  description:
    "Browse verified public and community causes with published line-item budgets and direct vendor payouts.",
};

export default function PublicCausesPage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-width py-8 sm:py-12">
      {/* Back button to the 2-option Gateway */}
      <div className="mb-8">
        <Link
          href="/explore"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-200 hover:bg-white hover:text-[#003087] dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="transition duration-200 group-hover:-translate-x-0.5">&larr;</span>
          <span>Back to Explore Options</span>
        </Link>
      </div>

      <CampaignExplore initialCategory="causes" showHeader={true} />
    </main>
  );
}
