import { notFound } from "next/navigation";
import CampaignDetail from "@/components/CampaignDetail";

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const id = Number(campaignId);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <CampaignDetail key={id} id={id} />;
}
