import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampInt } from "@/lib/pagination";

export const dynamic = "force-dynamic";

// 패키지 상품 목록 조회
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  // 페이지네이션 파라미터 정규화 — NaN/음수/과도한 limit 차단.
  // (검증이 없으면 ?page=-5 로 skip 이 음수가 되어 Prisma 가 예외를 던지고,
  //  ?limit=999999 로 테이블 전체를 한 번에 긁어가는 DoS 가 가능했다)
  const page = clampInt(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);

  const where: any = {};

  if (role === "SUPER_ADMIN") {
    // 관리자: 전체 조회
    if (status) where.status = status;
  } else if (role === "MIDDLE_ADMIN") {
    // 중간관리자: 본인 등록 패키지 + 소속(하위) 브랜드가 등록한 패키지
    const middleAdminId = (session.user as any).middleAdminId as string | undefined;
    where.OR = [
      { creatorId: userId },
      ...(middleAdminId ? [{ creator: { brandProfile: { middleAdminId } } }] : []),
    ];
    if (status) where.status = status;
  } else if (role === "BRAND_ADMIN" || role === "SELLER") {
    // 본인이 등록한 패키지만
    where.creatorId = userId;
    if (status) where.status = status;
  } else {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const [packages, total] = await Promise.all([
    prisma.packageProduct.findMany({
      where,
      include: {
        creator: { select: { name: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                thumbnail: true,
                brand: { select: { brandName: true } },
              },
            },
          },
        },
        _count: { select: { packageOrderItems: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.packageProduct.count({ where }),
  ]);

  return NextResponse.json({
    packages: packages.map((p) => ({
      ...p,
      packagePrice: Number(p.packagePrice),
      middleAdminMargin:
        (p as any).middleAdminMargin != null ? Number((p as any).middleAdminMargin) : null,
      items: p.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
      })),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// 패키지 상품 등록
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = (session.user as any).role as string;
  const userId = session.user.id as string;

  if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER", "MIDDLE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, imageUrl, packagePrice, stock, items } = body;

    if (!name || !packagePrice) {
      return NextResponse.json({ error: "패키지명과 판매가는 필수입니다." }, { status: 400 });
    }

    const parsedPrice = parseFloat(packagePrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: "유효한 패키지 판매가를 입력해주세요." }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length < 2) {
      return NextResponse.json({ error: "구성 상품은 최소 2개 이상 선택해야 합니다." }, { status: 400 });
    }

    // 구성 상품 유효성 검증 (존재하지 않는 productId로 인한 FK 오류 방지)
    const productIds = items.map((item: { productId: string }) => item.productId).filter(Boolean);
    if (productIds.length !== items.length) {
      return NextResponse.json({ error: "구성 상품 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const existingCount = await prisma.product.count({ where: { id: { in: productIds } } });
    if (existingCount !== new Set(productIds).size) {
      return NextResponse.json({ error: "존재하지 않는 상품이 포함되어 있습니다. 구성 상품을 다시 선택해주세요." }, { status: 400 });
    }

    // SUPER_ADMIN은 즉시 승인, 나머지는 PENDING
    const status = role === "SUPER_ADMIN" ? "APPROVED" : "PENDING";

    const packageProduct = await prisma.packageProduct.create({
      data: {
        name,
        description,
        imageUrl,
        packagePrice: parsedPrice,
        stock: parseInt(stock) || 0,
        status,
        creatorId: userId,
        creatorRole: role,
        items: {
          create: items.map((item: { productId: string; unitPrice: number; quantity?: number }) => ({
            productId: item.productId,
            unitPrice: Number(item.unitPrice) || 0,
            quantity: item.quantity || 1,
          })),
        },
      },
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
      ...packageProduct,
      packagePrice: Number(packageProduct.packagePrice),
      items: packageProduct.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
      })),
    }, { status: 201 });
  } catch (error: any) {
    console.error("패키지 상품 등록 오류:", error);
    // P2021: 테이블이 DB에 없음 (prisma db push 필요)
    if (
      error?.code === "P2021" ||
      (typeof error?.message === "string" && error.message.includes("package_product"))
    ) {
      return NextResponse.json(
        { error: "패키지 상품 DB 테이블이 없습니다. 'npx prisma db push'를 실행해 주세요." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "패키지 상품 등록에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
