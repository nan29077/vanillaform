import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 패키지 상품 상세 조회
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const pkg = await prisma.packageProduct.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              thumbnail: true,
              basePrice: true,
              supplyPrice: true,
              brand: { select: { id: true, brandName: true, userId: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!pkg) {
    return NextResponse.json({ error: "패키지 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ...pkg,
    packagePrice: Number(pkg.packagePrice),
    items: pkg.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      product: {
        ...item.product,
        basePrice: Number(item.product.basePrice),
        supplyPrice: item.product.supplyPrice ? Number(item.product.supplyPrice) : null,
      },
    })),
  });
}

// 패키지 상품 수정 / 승인 / 거부
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;

  const pkg = await prisma.packageProduct.findUnique({
    where: { id: params.id },
  });

  if (!pkg) {
    return NextResponse.json({ error: "패키지 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  // 승인 / 거부 (SUPER_ADMIN 전용)
  if (action === "approve" || action === "reject") {
    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "관리자만 승인/거부할 수 있습니다." }, { status: 403 });
    }

    const updated = await prisma.packageProduct.update({
      where: { id: params.id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        rejectReason: action === "reject" ? (body.rejectReason || null) : null,
      },
    });

    return NextResponse.json({
      ...updated,
      packagePrice: Number(updated.packagePrice),
    });
  }

  // 중간관리자 마진 설정 (본인 등록 패키지 또는 하위 브랜드가 등록한 패키지)
  if (action === "setMargin") {
    if (role !== "MIDDLE_ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "마진 설정 권한이 없습니다." }, { status: 403 });
    }

    if (role === "MIDDLE_ADMIN") {
      const middleAdminId = (session.user as any).middleAdminId as string | undefined;
      let allowed = pkg.creatorId === userId;
      if (!allowed && middleAdminId) {
        // 패키지 등록자가 본인 소속(하위) 브랜드인지 확인
        const creatorBrand = await prisma.brandProfile.findUnique({
          where: { userId: pkg.creatorId },
          select: { middleAdminId: true },
        });
        allowed = creatorBrand?.middleAdminId === middleAdminId;
      }
      if (!allowed) {
        return NextResponse.json({ error: "이 패키지에 대한 권한이 없습니다." }, { status: 403 });
      }
    }

    const rawMargin = body.middleAdminMargin;
    let margin: number | null = null;
    if (rawMargin !== undefined && rawMargin !== null && rawMargin !== "") {
      margin = parseFloat(String(rawMargin));
      if (isNaN(margin) || margin < 0) {
        return NextResponse.json({ error: "유효한 마진 금액을 입력해주세요." }, { status: 400 });
      }
    }

    const marginData: any = { middleAdminMargin: margin };
    // 마진 반영 판매가를 함께 넘긴 경우 갱신
    if (body.packagePrice !== undefined && body.packagePrice !== null && body.packagePrice !== "") {
      const price = parseFloat(String(body.packagePrice));
      if (isNaN(price) || price <= 0) {
        return NextResponse.json({ error: "유효한 판매가를 입력해주세요." }, { status: 400 });
      }
      marginData.packagePrice = price;
    }

    const updated = await prisma.packageProduct.update({
      where: { id: params.id },
      data: marginData,
    });

    return NextResponse.json({
      ...updated,
      packagePrice: Number(updated.packagePrice),
      middleAdminMargin:
        (updated as any).middleAdminMargin != null ? Number((updated as any).middleAdminMargin) : null,
    });
  }

  // 수정 (본인 또는 관리자)
  if (pkg.creatorId !== userId && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const { name, description, imageUrl, packagePrice, stock, items } = body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
  if (packagePrice !== undefined) updateData.packagePrice = parseFloat(packagePrice);
  if (stock !== undefined) updateData.stock = parseInt(stock);

  // 구성 상품 업데이트 (삭제 후 재생성)
  if (items && items.length >= 2) {
    await prisma.packageItem.deleteMany({ where: { packageId: params.id } });
    updateData.items = {
      create: items.map((item: { productId: string; unitPrice: number; quantity?: number }) => ({
        productId: item.productId,
        unitPrice: item.unitPrice,
        quantity: item.quantity || 1,
      })),
    };
  }

  const updated = await prisma.packageProduct.update({
    where: { id: params.id },
    data: updateData,
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, thumbnail: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ...updated,
    packagePrice: Number(updated.packagePrice),
    items: updated.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
    })),
  });
}

// 패키지 상품 삭제
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;

  const pkg = await prisma.packageProduct.findUnique({
    where: { id: params.id },
  });

  if (!pkg) {
    return NextResponse.json({ error: "패키지 상품을 찾을 수 없습니다." }, { status: 404 });
  }

  if (pkg.creatorId !== userId && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.packageProduct.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
