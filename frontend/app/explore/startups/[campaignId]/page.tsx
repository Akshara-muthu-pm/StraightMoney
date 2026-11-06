import { notFound } from "next/navigation";
import StartupCampaignDetail from "@/components/StartupCampaignDetail";

export default async function StartupCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const id = Number(campaignId);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <StartupCampaignDetail key={id} id={id} />;
}
