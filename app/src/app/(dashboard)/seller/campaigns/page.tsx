import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SellerGroupBuyForm from "@/components/shared/SellerGroupBuyForm";
import SellerAvailableCampaigns from "@/components/shared/SellerAvailableCampaigns";
import PaginatedCampaignList from "./PaginatedCampaignList";

export const dynamic = "force-dynamic";

export default async function SellerCampaignsPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      campaigns: {
        include: { product: { select: { name: true, thumbnail: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!seller) redirect("/");

  const active = seller.campaigns.filter((c) => c.status === "ACTIVE");
  const scheduled = seller.campaigns.filter((c) => c.status === "SCHEDULED");
  const ended = seller.campaigns.filter((c) => !["ACTIVE", "SCHEDULED"].includes(c.status));

  // 캠페인 배열을 클라이언트 컴포넌트로 넘길 수 있게 순수 객체로 직렬화
  const serializeCampaigns = (campaigns: typeof seller.campaigns) =>
    campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      campaignPrice: Number(c.campaignPrice),
      participantCount: c.participantCount,
      currentQuantity: c.currentQuantity,
      goalQuantity: c.goalQuantity,
      product: { name: c.product.name },
    }));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">공동구매 관리</h1>
          <p className="text-sm text-gray-500">총 {seller.campaigns.length}개의 공동구매</p>
        </div>
        <SellerGroupBuyForm />
      </div>

      {/* Available brand campaigns to join */}
      <SellerAvailableCampaigns />

      {seller.campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="Cart" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">등록된 공동구매가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">위의 브랜드 공동구매에 참여하거나 직접 공동구매를 등록하세요.</p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-bold text-gray-900 mb-3 mt-2">내 공동구매</h2>
          {active.length > 0 && <PaginatedCampaignList campaigns={serializeCampaigns(active)} label="진행 중" />}
          {scheduled.length > 0 && <PaginatedCampaignList campaigns={serializeCampaigns(scheduled)} label="예정" />}
          {ended.length > 0 && <PaginatedCampaignList campaigns={serializeCampaigns(ended)} label="종료" />}
        </>
      )}
    </div>
  );
}
