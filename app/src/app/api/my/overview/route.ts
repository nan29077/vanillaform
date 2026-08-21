import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      buyerProfile: {
        include: {
          referredBySeller: {
            select: { id: true, shopName: true, slug: true, referralDiscountRate: true, pickDiscountRate: true },
          },
          follows: {
            include: {
              seller: {
                select: {
                  id: true, shopName: true, slug: true, shopLogo: true, pickDiscountRate: true, isManualLive: true,
                  user: { select: { avatar: true } },
                  liveStreams: { where: { status: "LIVE" }, take: 1, select: { id: true, shareCode: true } },
                },
              },
            },
          },
        },
      },
      orders: {
        include: { seller: true, items: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      wishlists: {
        include: {
          product: {
            include: {
              brand: true,
              sellerProducts: {
                where: { isActive: true },
                include: { seller: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
      sellerProfile: { select: { id: true, isApproved: true } },
      _count: { select: { orders: true, reviews: true, cartItems: true, wishlists: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "유저 없음" }, { status: 404 });

  const gameCouponCount = await prisma.userGameCoupon.count({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
  });

  const flags = await getFeatureFlags();

  // Decimal → number 직렬화
  const wishlists = user.wishlists.map((w) => ({
    ...w,
    product: {
      ...w.product,
      basePrice: Number(w.product.basePrice),
      comparePrice: w.product.comparePrice ? Number(w.product.comparePrice) : null,
    },
  }));

  const orders = user.orders.map((o) => ({
    ...o,
    finalAmount: Number(o.finalAmount),
    discountAmount: o.discountAmount ? Number(o.discountAmount) : null,
    createdAt: o.createdAt.toISOString(),
  }));

  const referredSeller = user.buyerProfile?.referredBySeller;
  const pickedSellers = user.buyerProfile?.follows || [];

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    },
    counts: user._count,
    orders,
    wishlists,
    pickedSellers: pickedSellers.map((f) => ({
      seller: {
        ...f.seller,
        liveStreams: f.seller.liveStreams,
      },
    })),
    gameCouponCount,
    sellerApplied: !!user.sellerProfile,
    referredSeller: referredSeller
      ? {
          ...referredSeller,
          referralDiscountRate: Number(referredSeller.referralDiscountRate),
          pickDiscountRate: Number(referredSeller.pickDiscountRate),
        }
      : null,
    flags,
  });
}
