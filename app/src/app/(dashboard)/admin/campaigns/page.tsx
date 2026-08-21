import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice, getProgressPercent } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import AdminCampaignsClient from "@/components/admin/AdminCampaignsClient";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/");

  const campaigns = await prisma.groupBuyCampaign.findMany({
    include: {
      seller: { select: { shopName: true } },
      product: {
        select: {
          name: true,
          thumbnail: true,
          brand: { select: { brandName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = campaigns.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    campaignPrice: Number(c.campaignPrice),
    participantCount: c.participantCount,
    currentQuantity: c.currentQuantity,
    goalQuantity: c.goalQuantity,
    totalRevenue: Number(c.totalRevenue),
    sellerName: c.seller.shopName,
    productName: c.product.name,
    brandName: c.product.brand?.brandName || null,
    thumbnail: c.product.thumbnail,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in">
      <AdminCampaignsClient campaigns={serialized} />
    </div>
  );
}
