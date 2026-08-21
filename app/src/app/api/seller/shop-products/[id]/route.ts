import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 셀러 샵 상품 신청 취소 — 타인(브랜드/관리자) 등록 상품에 대한 '승인 대기' 신청건만 삭제.
// 본인 등록 상품(자동 승인) 및 이미 승인된 판매 상품은 삭제 대상이 아니다.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

  const { id } = await Promise.resolve(params);

  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id }, select: { id: true } });
  if (!seller) return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });

  const shopProduct = await prisma.sellerShopProduct.findUnique({
    where: { id },
    select: { id: true, sellerId: true, isApproved: true, product: { select: { sellerId: true } } },
  });
  if (!shopProduct || shopProduct.sellerId !== seller.id) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  // 본인이 직접 등록한 상품(자동 승인)은 신청 취소 대상이 아니다.
  if (shopProduct.product.sellerId === seller.id) {
    return NextResponse.json({ error: "본인 등록 상품은 신청 취소할 수 없습니다." }, { status: 400 });
  }
  // 이미 승인된 판매 상품은 취소가 아닌 판매관리(삭제)로 처리한다.
  if (shopProduct.isApproved) {
    return NextResponse.json({ error: "이미 승인된 상품은 신청 취소할 수 없습니다." }, { status: 400 });
  }

  await prisma.sellerShopProduct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
