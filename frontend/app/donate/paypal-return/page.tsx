import PayPalReturnClient from "./PayPalReturnClient";

export default async function PayPalReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;
  const cancelled = params.cancelled === "1";
  const campaign = Number(params.campaign_id);
  const campaignId = Number.isSafeInteger(campaign) && campaign > 0 ? campaign : null;

  return <PayPalReturnClient token={token} cancelled={cancelled} campaignId={campaignId} />;
}
