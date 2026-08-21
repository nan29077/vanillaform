import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sellerProfileImage } from "@/lib/sellerLive";

// GET: 라이브 채널 페이지 데이터 (방송 상태, OFF 썸네일, 예약 목록, 상품, 공지 수)
export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const live = await prisma.liveStream.findUnique({
      where: { shareCode: params.code },
      include: {
        seller: {
          select: {
            id: true,
            shopName: true,
            shopLogo: true,
            user: { select: { avatar: true } },
            shopDescription: true,
            slug: true,
            totalFans: true,
            businessType: true,
            representativeName: true,
            businessRegistrationNo: true,
            telecomSalesLicenseNo: true,
            businessAddress: true,
            businessCategory: true,
            _count: { select: { followers: true, liveStreams: true } },
          },
        },
        products: {
          include: {
            product: {
              select: { id: true, name: true, thumbnail: true, basePrice: true, comparePrice: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        coupons: {
          select: { id: true, code: true, discountType: true, discountValue: true, validDays: true, minOrderAmount: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!live) {
      return NextResponse.json({ error: "라이브 채널을 찾을 수 없습니다." }, { status: 404 });
    }

    // 같은 셀러의 예약된 라이브 목록 (현재 라이브 포함)
    const scheduledLives = await prisma.liveStream.findMany({
      where: { sellerId: live.sellerId, status: "SCHEDULED" },
      select: { id: true, title: true, scheduledAt: true, shareCode: true, thumbnailImage: true },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    });

    // liveSiteSettings: DB 컬럼이 없을 수 있으므로 별도 try/catch로 안전 처리
    let liveSiteSettings: string | null = null;
    try {
      const sellerWithSettings = await prisma.sellerProfile.findUnique({
        where: { id: live.sellerId },
        select: { liveSiteSettings: true } as any,
      });
      liveSiteSettings = (sellerWithSettings as any)?.liveSiteSettings ?? null;
    } catch {
      // DB 컬럼 미반영 시 null 반환 (안전 처리)
    }

    // 현재 라이브가 LIVE 상태가 아닐 때, 같은 셀러의 활성(LIVE) 방송이 새로 시작됐는지 확인
    // → 클라이언트에서 새 shareCode로 리다이렉트하는 데 사용
    let activeShareCode: string | null = null;
    if (live.status !== "LIVE") {
      try {
        const activeLive = await prisma.liveStream.findFirst({
          where: {
            sellerId: live.sellerId,
            status: "LIVE",
            NOT: { shareCode: params.code },
          },
          select: { shareCode: true },
          orderBy: { startedAt: "desc" },
        });
        activeShareCode = activeLive?.shareCode ?? null;
      } catch {}
    }

    // 채널 공지 수 (테이블/클라이언트 미반영 시에도 채널 페이지가 죽지 않도록 fallback)
    let noticeCount = 0;
    try {
      noticeCount = await prisma.liveChannelNotice.count({
        where: { sellerId: live.sellerId },
      });
    } catch (noticeError) {
      console.error("채널 공지 수 조회 실패 (0으로 fallback):", noticeError);
    }

    // 로그인 상태면 팔로우 여부 확인
    let isFollowing = false;
    const session = await auth();
    if (session?.user?.id) {
      const buyer = await prisma.buyerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (buyer) {
        const follow = await prisma.sellerFollower.findUnique({
          where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: live.sellerId } },
        });
        isFollowing = !!follow;
      }
    }

    return NextResponse.json({
      channel: {
        id: live.id,
        title: live.title,
        description: live.description,
        thumbnailImage: live.thumbnailImage,
        status: live.status,
        shareCode: live.shareCode,
        scheduledAt: live.scheduledAt,
        startedAt: live.startedAt,
        endedAt: live.endedAt,
        viewerCount: live.viewerCount,
        peakViewerCount: live.peakViewerCount,
        likeCount: live.likeCount,
        isVodSaved: live.isVodSaved,
        externalUrl: live.externalUrl,
        offThumbnailUrl: live.offThumbnailUrl,
        offLinkUrl: live.offLinkUrl,
        offLinkText: live.offLinkText,
        seller: {
          id: live.seller.id,
          shopName: live.seller.shopName,
          shopLogo: sellerProfileImage(live.seller),
          shopDescription: live.seller.shopDescription,
          slug: live.seller.slug,
          totalFans: live.seller.totalFans,
          businessType: live.seller.businessType ?? null,
          representativeName: live.seller.representativeName ?? null,
          businessRegistrationNo: live.seller.businessRegistrationNo ?? null,
          telecomSalesLicenseNo: live.seller.telecomSalesLicenseNo ?? null,
          businessAddress: live.seller.businessAddress ?? null,
          businessCategory: live.seller.businessCategory ?? null,
          _count: live.seller._count,
          liveSiteSettings: liveSiteSettings ?? null,
        },
        products: live.products.map((p) => ({
          id: p.id,
          isActive: p.isActive,
          sortOrder: p.sortOrder,
          livePrice: p.livePrice ? Number(p.livePrice) : null,
          product: {
            ...p.product,
            basePrice: Number(p.product.basePrice),
            comparePrice: p.product.comparePrice ? Number(p.product.comparePrice) : null,
          },
        })),
        coupons: live.coupons.map((c) => ({
          id: c.id,
          code: c.code,
          discountType: c.discountType,
          discountValue: Number(c.discountValue),
          validDays: c.validDays,
          minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
        })),
        scheduledLives,
        noticeCount,
        isFollowing,
        isLoggedIn: !!session?.user,
        activeShareCode,
      },
    });
  } catch (error) {
    console.error("채널 데이터 조회 오류:", error);
    return NextResponse.json({ error: "채널 정보를 불러올 수 없습니다." }, { status: 500 });
  }
}
