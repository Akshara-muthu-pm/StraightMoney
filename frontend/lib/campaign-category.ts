import type { CampaignSummary } from "./types";

export function isStartupCampaign(campaign: Pick<CampaignSummary, "title" | "description">): boolean {
  return /startup|venture|drone|aerodrone|robotics|prototype|hardware/i.test(`${campaign.title} ${campaign.description ?? ""}`);
}
