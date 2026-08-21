import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CampaignListClient from "@/components/shared/CampaignListClient";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { groupBuy: FEATURE_GROUP_BUY } = await getFeatureFlags();
  if (!FEATURE_GROUP_BUY) notFound();

  const campaigns = await prisma.groupBuyCampaign.findMany({
    include: {
      seller: true,
      product: true,
    },
    orderBy: [{ status: "asc" }, { endDate: "asc" }],
  });

  const mapCampaign = (c: (typeof campaigns)[0]) => ({
    id: c.id,
    title: c.title,
    campaignPrice: Number(c.campaignPrice),
    originalPrice: Number(c.originalPrice),
    status: c.status,
    endDate: new Date(c.endDate).toISOString(),
    currentQuantity: c.currentQuantity,
    goalQuantity: c.goalQuantity,
    participantCount: c.participantCount,
    bannerImage: c.bannerImage,
    seller: {
      slug: c.seller.slug,
      shopName: c.seller.shopName,
      shopLogo: c.seller.shopLogo,
    },
    product: {
      name: c.product.name,
      thumbnail: c.product.thumbnail,
    },
  });

  const live = campaigns.filter((c) => c.status === "ACTIVE").map(mapCampaign);
  const scheduled = campaigns.filter((c) => c.status === "SCHEDULED").map(mapCampaign);
  const ended = campaigns
  .filter((c) => ["FAILED", "SUCCESS", "SOLDOUT", "CANCELLED", "SETTLED", "REFUNDING", "REFUNDED"].includes(c.status)).map(mapCampaign);

  return (
    <div className="animate-fade-in">
      <CampaignListClient live={live} scheduled={scheduled} ended={ended} />
    </div>
  );
}
