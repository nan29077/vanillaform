import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/curation - 메인 페이지 큐레이션 데이터
// 셀러/관리자/소싱 멤버가 등록한 상품을 자동으로 메인에 연동
// 로직:
//  1. 인기상품: soldCount 높은 순 (실시간 인기 반영)
//  2. 신상품: 최근 승인된 상품
//  3. 셀러 추천: 가장 많은 팬을 보유한 셀러의 상품
//  4. 트렌드: 캠페인 참여수 기반
//  5. 카테고리별 인기: 각 카테고리별 상위 상품
export async function GET() {
  try {
    const [
      hotProducts,
      newProducts,
      trendingCampaigns,
      topSellers,
      categoryProducts,
    ] = await Promise.all([
      // 1. 실시간 인기 상품 (판매량 기준)
      prisma.product.findMany({
        where: { isActive: true, isApproved: true },
        include: { brand: true, category: true },
        orderBy: { soldCount: "desc" },
        take: 10,
      }),
      // 2. 신상품 (최근 등록 + 승인)
      prisma.product.findMany({
        where: { isActive: true, isApproved: true },
        include: { brand: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      // 3. 트렌딩 캠페인 (참여자 많은 순)
      prisma.groupBuyCampaign.findMany({
        where: { status: "ACTIVE" },
        include: { seller: true, product: true },
        orderBy: { participantCount: "desc" },
        take: 6,
      }),
      // 4. TOP 셀러 (팬 수 기준)
      prisma.sellerProfile.findMany({
        where: { isApproved: true },
        include: {
          user: { select: { name: true } },
          _count: { select: { campaigns: true, shopProducts: true } },
        },
        orderBy: { totalFans: "desc" },
        take: 5,
      }),
      // 5. 카테고리별 인기 상품
      prisma.category.findMany({
        include: {
          products: {
            where: { isActive: true, isApproved: true },
            orderBy: { soldCount: "desc" },
            take: 4,
            include: { brand: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return NextResponse.json({
      hotProducts,
      newProducts,
      trendingCampaigns,
      topSellers,
      categoryProducts: categoryProducts.filter(c => c.products.length > 0),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch curation data" }, { status: 500 });
  }
}
