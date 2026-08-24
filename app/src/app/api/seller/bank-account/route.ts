import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET: 계좌 정보 조회 — **어떤 분기보다 auth() 가 먼저다.**
//
// 과거에는 `?sellerId=` 가 붙으면 auth() 를 아예 거치지 않고 곧바로 계좌번호를 반환해,
// 비로그인 상태에서 sellerId 만 바꿔가며 전 셀러의 예금주·계좌번호를 긁어갈 수 있었다.
//
// 권한 정책
//  1) `?sellerId=` 만 있는 조회(= 임의 셀러 계좌 열람)
//     → SUPER_ADMIN / MIDDLE_ADMIN 만 허용. 셀러 본인도 자기 sellerId 면 허용.
//  2) `?sellerId=&productId=` (소셜주문서 입금 안내 전용)
//     → 구매자가 직접 이체해야 하는 구조라 계좌 노출 자체가 기능 요건이다.
//       단 "승인된 셀러" + "그 셀러 샵에 실제로 있는 상품"일 때만 반환해,
//       sellerId 만 바꿔가며 전수 수집하는 경로를 막는다.
//  3) 파라미터 없음 → 로그인한 셀러 본인 계좌 (설정 페이지용)
export async function GET(request: Request) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get("sellerId");
  const productId = searchParams.get("productId");

  const role = (session?.user as any)?.role as string | undefined;
  const userId = session?.user?.id;

  if (sellerId) {
    const isAdmin = role === "SUPER_ADMIN" || role === "MIDDLE_ADMIN";

    // 소유 여부는 "요청자 자신의 셀러 프로필"만 읽어서 판정한다.
    // 대상 셀러를 먼저 조회하면 존재 여부(404 vs 403)가 익명 요청에도 새어나간다.
    let isOwner = false;
    if (!isAdmin && userId && role === "SELLER") {
      const me = await prisma.sellerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      isOwner = !!me && me.id === sellerId;
    }

    if (!isAdmin && !isOwner) {
      // 소셜주문서 입금 안내 경로만 예외로 허용한다.
      // (승인된 셀러 + 그 셀러 샵에 실제로 있는 상품일 때만)
      if (!productId) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
      const target = await prisma.sellerProfile.findUnique({
        where: { id: sellerId },
        select: { id: true, isApproved: true },
      });
      if (!target || !target.isApproved) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
      const inShop = await prisma.sellerShopProduct.findFirst({
        where: { sellerId: target.id, productId, isActive: true, isApproved: true },
        select: { id: true },
      });
      const ownProduct = inShop
        ? null
        : await prisma.product.findFirst({
            where: { id: productId, sellerId: target.id },
            select: { id: true },
          });
      if (!inShop && !ownProduct) {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { user: { select: { bankName: true, bankAccount: true, bankHolder: true } } },
    });
    if (!seller) {
      return NextResponse.json({ error: "셀러를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({
      bankName: seller.user?.bankName ?? null,
      bankAccount: seller.user?.bankAccount ?? null,
      bankHolder: seller.user?.bankHolder ?? null,
    });
  }

  if (!userId || role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bankName: true, bankAccount: true, bankHolder: true },
  });

  return NextResponse.json({
    bankName: user?.bankName ?? null,
    bankAccount: user?.bankAccount ?? null,
    bankHolder: user?.bankHolder ?? null,
  });
}

// PATCH: 로그인한 셀러 본인의 계좌 정보 수정
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { bankName, bankAccount, bankHolder } = body || {};

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
        bankHolder: bankHolder?.trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bank account update error:", error);
    return NextResponse.json({ error: "계좌 정보 수정에 실패했습니다." }, { status: 500 });
  }
}
