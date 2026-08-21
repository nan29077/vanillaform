import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 일반상품 소유권 검증 후 셀러 프로필 id 반환
async function getOwnedProduct(userId: string, productId: string) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!seller) return { error: "셀러 프로필을 찾을 수 없습니다.", status: 404 as const };
  const product = await prisma.directProduct.findUnique({ where: { id: productId }, select: { id: true, sellerId: true } });
  if (!product || product.sellerId !== seller.id) return { error: "상품을 찾을 수 없습니다.", status: 404 as const };
  return { sellerId: seller.id };
}

// 일반상품 수정
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

  const { id } = await Promise.resolve(params);
  const owned = await getOwnedProduct(session.user!.id, id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "상품명을 입력해주세요." }, { status: 400 });
    data.name = name;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "올바른 판매가격을 입력해주세요." }, { status: 400 });
    data.price = price;
  }
  if (body.description !== undefined) data.description = typeof body.description === "string" ? body.description : null;
  if (body.images !== undefined) {
    const images = Array.isArray(body.images) ? body.images.filter((u: any) => typeof u === "string") : [];
    data.images = images.length > 0 ? JSON.stringify(images) : null;
  }
  if (body.stock !== undefined) data.stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.floor(Number(body.stock))) : 0;
  if (body.shippingFee !== undefined) data.shippingFee = Number.isFinite(Number(body.shippingFee)) ? Math.max(0, Number(body.shippingFee)) : 0;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });

  await prisma.directProduct.update({ where: { id }, data });
  return NextResponse.json({ success: true });
}

// 일반상품 삭제
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

  const { id } = await Promise.resolve(params);
  const owned = await getOwnedProduct(session.user!.id, id);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });

  await prisma.directProduct.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
