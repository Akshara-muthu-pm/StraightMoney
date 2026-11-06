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
      <Link href="/explore" className="mb-8 inline-block text-sm font-medium text-[#003087] dark:text-sky-300">&larr; Explore</Link>
      <CampaignExplore />
    </main>
  );
}
