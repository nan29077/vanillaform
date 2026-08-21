import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 로그인 셀러의 직접 등록 일반상품 목록 조회
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id }, select: { id: true } });
  if (!seller) return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });

  const products = await prisma.directProduct.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      shippingFee: Number(p.shippingFee),
      description: p.description,
      images: (() => { try { return JSON.parse(p.images || "[]"); } catch { return []; } })(),
      stock: p.stock,
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// 새 일반상품 등록
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id }, select: { id: true } });
  if (!seller) return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = Number(body.price);
  if (!name) return NextResponse.json({ error: "상품명을 입력해주세요." }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "올바른 판매가격을 입력해주세요." }, { status: 400 });

  const images = Array.isArray(body.images) ? body.images.filter((u: any) => typeof u === "string") : [];
  const stock = Number.isFinite(Number(body.stock)) ? Math.max(0, Math.floor(Number(body.stock))) : 0;
  const shippingFee = Number.isFinite(Number(body.shippingFee)) ? Math.max(0, Number(body.shippingFee)) : 0;

  const created = await prisma.directProduct.create({
    data: {
      sellerId: seller.id,
      name,
      price,
      shippingFee,
      description: typeof body.description === "string" ? body.description : null,
      images: images.length > 0 ? JSON.stringify(images) : null,
      stock,
      isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    },
  });

  return NextResponse.json({ success: true, id: created.id });
}
