import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch chat messages for a product
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId는 필수입니다" }, { status: 400 });
    }

    // Verify the user has access to this product
    if (role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
      if (!seller) return NextResponse.json({ error: "라이브 셀러 정보 없음" }, { status: 403 });
      const shopProduct = await prisma.sellerShopProduct.findFirst({
        where: { sellerId: seller.id, productId },
      });
      if (!shopProduct) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    } else if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
      if (!brand) return NextResponse.json({ error: "브랜드 정보 없음" }, { status: 403 });
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || product.brandId !== brand.id) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const messages = await prisma.productChat.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Mark messages as read for this user
    await prisma.productChat.updateMany({
      where: {
        productId,
        senderId: { not: session.user!.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Product chat fetch error:", error);
    return NextResponse.json({ error: "채팅 조회 실패" }, { status: 500 });
  }
}

// POST: Send a chat message for a product
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { productId, message } = await req.json();
    if (!productId || !message?.trim()) {
      return NextResponse.json({ error: "productId와 message는 필수입니다" }, { status: 400 });
    }

    let senderName = session.user!.name || "알 수 없음";

    // Verify access
    if (role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
      if (!seller) return NextResponse.json({ error: "라이브 셀러 정보 없음" }, { status: 403 });
      const shopProduct = await prisma.sellerShopProduct.findFirst({
        where: { sellerId: seller.id, productId },
      });
      if (!shopProduct) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
      senderName = seller.shopName;
    } else if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
      if (!brand) return NextResponse.json({ error: "브랜드 정보 없음" }, { status: 403 });
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || product.brandId !== brand.id) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
      senderName = brand.brandName;
    }

    const chatMessage = await prisma.productChat.create({
      data: {
        productId,
        senderId: session.user!.id,
        senderRole: role,
        senderName,
        message: message.trim(),
      },
    });

    return NextResponse.json({ success: true, message: chatMessage });
  } catch (error) {
    console.error("Product chat send error:", error);
    return NextResponse.json({ error: "메시지 전송 실패" }, { status: 500 });
  }
}
