import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: Manage product actions (hide, show, delete)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { productId, action, shopProductId } = await req.json();
    if (!productId || !action) {
      return NextResponse.json({ error: "productId와 action은 필수입니다" }, { status: 400 });
    }

    // 판매 시작/중지/일시중지 (셀러 샵 상품 단위)
    if (action === "startSale" || action === "stopSale" || action === "pauseSale") {
      const newActive = action === "startSale";
      if (shopProductId) {
        // 승인 시 isApproved도 함께 설정
        const updateData: any = { isActive: newActive };
        if (action === "startSale") {
          updateData.isApproved = true;
        }
        await prisma.sellerShopProduct.update({
          where: { id: shopProductId },
          data: updateData,
        });
      } else {
        if (role === "SELLER") {
          const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
          if (seller) {
            const updateData: any = { isActive: newActive };
            if (action === "startSale") {
              updateData.isApproved = true;
            }
            await prisma.sellerShopProduct.updateMany({
              where: { sellerId: seller.id, productId },
              data: updateData,
            });
          }
        } else {
          await prisma.product.update({
            where: { id: productId },
            data: { isActive: newActive },
          });
        }
      }
      const msgs: Record<string, string> = {
        startSale: "판매가 재시작되었습니다",
        stopSale: "판매가 중지되었습니다",
        pauseSale: "판매가 일시중지되었습니다",
      };
      return NextResponse.json({ success: true, message: msgs[action] || "처리되었습니다" });
    }

    // Verify the product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { brand: true },
    });
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    // Check permissions
    if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!brand || product.brandId !== brand.id) {
        return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
      }
    }

    if (role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!seller) {
        return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다" }, { status: 403 });
      }
      // For seller, check if the product is in their shop
      const shopProduct = await prisma.sellerShopProduct.findFirst({
        where: { sellerId: seller.id, productId },
      });
      if (!shopProduct) {
        return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
      }
    }

    switch (action) {
      case "hide":
        await prisma.product.update({
          where: { id: productId },
          data: { isActive: false },
        });
        return NextResponse.json({ success: true, message: "상품이 숨겨졌습니다" });

      case "show":
        await prisma.product.update({
          where: { id: productId },
          data: { isActive: true },
        });
        return NextResponse.json({ success: true, message: "상품이 공개되었습니다" });

      case "enableGroupBuy":
        if (!["SUPER_ADMIN", "BRAND_ADMIN"].includes(role)) {
          return NextResponse.json({ error: "관리자/브랜드만 설정 가능합니다" }, { status: 403 });
        }
        await prisma.product.update({
          where: { id: productId },
          data: { allowGroupBuy: true },
        });
        return NextResponse.json({ success: true, message: "공동구매 상품으로 등록되었습니다" });

      case "disableGroupBuy":
        if (!["SUPER_ADMIN", "BRAND_ADMIN"].includes(role)) {
          return NextResponse.json({ error: "관리자/브랜드만 설정 가능합니다" }, { status: 403 });
        }
        await prisma.product.update({
          where: { id: productId },
          data: { allowGroupBuy: false },
        });
        return NextResponse.json({ success: true, message: "공동구매 상품에서 제외되었습니다" });

      case "enableLiveCommerce":
        if (!["SUPER_ADMIN", "BRAND_ADMIN"].includes(role)) {
          return NextResponse.json({ error: "관리자/브랜드만 설정 가능합니다" }, { status: 403 });
        }
        await prisma.product.update({
          where: { id: productId },
          data: { allowLiveCommerce: true },
        });
        return NextResponse.json({ success: true, message: "라이브커머스 상품으로 등록되었습니다" });

      case "disableLiveCommerce":
        if (!["SUPER_ADMIN", "BRAND_ADMIN"].includes(role)) {
          return NextResponse.json({ error: "관리자/브랜드만 설정 가능합니다" }, { status: 403 });
        }
        await prisma.product.update({
          where: { id: productId },
          data: { allowLiveCommerce: false },
        });
        return NextResponse.json({ success: true, message: "라이브커머스 상품에서 제외되었습니다" });

      case "delete":
        // Delete related records first
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
        return NextResponse.json({ success: true, message: "상품이 삭제되었습니다" });

      default:
        return NextResponse.json({ error: "잘못된 action입니다" }, { status: 400 });
    }
  } catch (error) {
    console.error("Product manage error:", error);
    return NextResponse.json({ error: "작업 실패" }, { status: 500 });
  }
}
