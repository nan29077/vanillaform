import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 중간관리자 권한 + 본인 middleAdminId 확인 헬퍼
async function requireMiddleAdmin() {
  const session = await auth();
  const role = session?.user?.role;
  const middleAdminId = session?.user?.middleAdminId as string | undefined;
  if (role !== "MIDDLE_ADMIN" || !middleAdminId) {
    return { error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { middleAdminId };
}

// 금액 파싱: 비어있으면 null, 음수/NaN도 null 처리
function toMoneyOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? null : n;
}

// GET: 본인 소속 브랜드들의 상품 목록 (가격 설정/공개 관리용)
export async function GET() {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      brand: { middleAdminId: guard.middleAdminId },
    },
    include: {
      brand: { select: { brandName: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      brandName: p.brand?.brandName || null,
      categoryName: p.category?.name || null,
      supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
      basePrice: Number(p.basePrice),
      middleAdminMargin: p.middleAdminMargin != null ? Number(p.middleAdminMargin) : null,
      isApproved: p.isApproved, // 셀러 공개 여부
      createdAt: p.createdAt,
    })),
  });
}

// POST: 상품 가격(판매가/마진) 설정
// body: { productId, basePrice?, middleAdminMargin? }
// 참고: isApproved(셀러 공개 여부)는 최고관리자만 변경 가능
export async function POST(request: Request) {
  const guard = await requireMiddleAdmin();
  if ("error" in guard) return guard.error;

  try {
    const body = await request.json();
    const { productId, basePrice, middleAdminMargin } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId는 필수입니다." }, { status: 400 });
    }

    // 본인 소속 브랜드의 상품인지 확인
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { brand: { select: { middleAdminId: true } } },
    });
    if (!product || product.brand?.middleAdminId !== guard.middleAdminId) {
      return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다." }, { status: 403 });
    }

    const data: any = {};

    // 판매가 설정
    const parsedBasePrice = toMoneyOrNull(basePrice);
    if (basePrice !== undefined) {
      if (parsedBasePrice === null) {
        return NextResponse.json({ error: "유효한 판매가를 입력해주세요." }, { status: 400 });
      }
      data.basePrice = parsedBasePrice;
    }

    // 마진 설정 (직접 입력) — 음수는 조용히 null 처리하지 않고 명시적으로 거부
    if (middleAdminMargin !== undefined && middleAdminMargin !== null && middleAdminMargin !== "") {
      const m = parseFloat(String(middleAdminMargin));
      if (isNaN(m) || m < 0) {
        return NextResponse.json({ error: "마진은 0 이상의 숫자여야 합니다." }, { status: 400 });
      }
    }
    if (middleAdminMargin !== undefined) {
      data.middleAdminMargin = toMoneyOrNull(middleAdminMargin);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
    }

    // 저장 후 최종 상태 기준 검증 — 판매가<공급가 역전, 판매가≠공급가+마진 불일치 차단
    // (구버전 화면·직접 호출 등 어떤 경로로 와도 어긋난 가격이 저장되지 않도록 서버에서 막는다)
    const supply = product.supplyPrice != null ? Number(product.supplyPrice) : null;
    if (supply != null) {
      const finalBase = data.basePrice !== undefined ? data.basePrice : Number(product.basePrice);
      const finalMargin =
        data.middleAdminMargin !== undefined
          ? data.middleAdminMargin
          : product.middleAdminMargin != null
            ? Number(product.middleAdminMargin)
            : null;
      if (finalBase < supply) {
        return NextResponse.json(
          { error: `판매가(${finalBase.toLocaleString()}원)는 공급가(${supply.toLocaleString()}원)보다 낮을 수 없습니다.` },
          { status: 400 }
        );
      }
      if (finalMargin != null && finalBase !== supply + finalMargin) {
        return NextResponse.json(
          {
            error: `판매가와 마진이 맞지 않습니다. 공급가 ${supply.toLocaleString()}원 + 마진 ${finalMargin.toLocaleString()}원 = ${(supply + finalMargin).toLocaleString()}원이어야 합니다.`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data,
      select: { id: true, basePrice: true, middleAdminMargin: true, isApproved: true },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updated.id,
        basePrice: Number(updated.basePrice),
        middleAdminMargin: updated.middleAdminMargin != null ? Number(updated.middleAdminMargin) : null,
        isApproved: updated.isApproved,
      },
    });
  } catch (error) {
    console.error("Middle product update error:", error);
    return NextResponse.json({ error: "상품 업데이트에 실패했습니다." }, { status: 500 });
  }
}
