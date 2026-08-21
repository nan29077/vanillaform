import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: Admin approves/rejects seller product request AND can approve product itself
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
    }

    const { action, shopProductId, productId, brandId, productIds, rejectionReason, adminMargin } = await req.json();

    if (action === "bulk_approve_products" && Array.isArray(productIds) && productIds.length > 0) {
      const res = await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { isApproved: true },
      });
      return NextResponse.json({ success: true, count: res.count, message: `${res.count}개 상품 승인됨` });
    }

    if (action === "approve_shop_product" && shopProductId) {
      await prisma.sellerShopProduct.update({
        where: { id: shopProductId },
        data: { isApproved: true, isActive: true, rejectionReason: null },
      });
      return NextResponse.json({ success: true, message: "라이브 셀러 상품 승인됨" });
    }

    if (action === "reject_shop_product" && shopProductId) {
      const reason = typeof rejectionReason === "string" ? rejectionReason.trim().slice(0, 500) : "";
      await prisma.sellerShopProduct.update({
        where: { id: shopProductId },
        data: { isApproved: false, isActive: false, rejectionReason: reason || "사유 미입력" },
      });
      return NextResponse.json({ success: true, message: "라이브 셀러 상품 반려됨" });
    }

    if (action === "approve_product" && productId) {
      // Approve a product and optionally set brand / adminMargin
      const updateData: any = { isApproved: true };
      if (brandId) updateData.brandId = brandId;
      if (typeof adminMargin === "number" && adminMargin >= 0) {
        updateData.adminMargin = Math.floor(adminMargin);
      }

      await (prisma as any).product.update({
        where: { id: productId },
        data: updateData,
      });
      return NextResponse.json({ success: true, message: "상품 승인됨" });
    }

    if (action === "reject_product" && productId) {
      await prisma.$transaction([
        prisma.shoppingTag.deleteMany({ where: { productId } }),
        prisma.cartItem.deleteMany({ where: { productId } }),
        prisma.wishlist.deleteMany({ where: { productId } }),
        prisma.productImage.deleteMany({ where: { productId } }),
        prisma.productVariant.deleteMany({ where: { productId } }),
        prisma.sellerShopProduct.deleteMany({ where: { productId } }),
        prisma.groupBuyCampaign.deleteMany({ where: { productId } }),
        prisma.review.deleteMany({ where: { productId } }),
        prisma.orderItem.deleteMany({ where: { productId } }),
        prisma.product.delete({ where: { id: productId } }),
      ]);
      return NextResponse.json({ success: true, message: "상품이 반려되었습니다" });
    }

    if (action === "link_brand" && productId && brandId) {
      await prisma.product.update({
        where: { id: productId },
        data: { brandId },
      });
      return NextResponse.json({ success: true, message: "브랜드 연결됨" });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
