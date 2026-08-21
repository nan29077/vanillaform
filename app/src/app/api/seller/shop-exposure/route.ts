import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 현재 셀러의 일반상품 노출 설정 조회
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });

    const exposure = await (prisma as any).shopDirectProductExposure.findUnique({ where: { sellerProfileId: seller.id } });
    const productIds: string[] = (() => { try { return JSON.parse(exposure?.productIds || "[]"); } catch { return []; } })();

    return NextResponse.json({
      isEnabled: exposure?.isEnabled ?? false,
      productIds,
    });
  } catch (e: any) {
    console.error("[shop-exposure GET]", e?.message || e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// 노출 스위치(isEnabled) 토글 및 선택 상품(productIds) 업데이트
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
    if (session.user?.role !== "SELLER") return NextResponse.json({ error: "셀러만 접근 가능" }, { status: 403 });

    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "셀러 프로필을 찾을 수 없습니다." }, { status: 404 });

    const body = await req.json().catch(() => ({}));

    const data: { isEnabled?: boolean; productIds?: string } = {};
    if (typeof body.isEnabled === "boolean") data.isEnabled = body.isEnabled;
    if (body.productIds !== undefined) {
      const ids = Array.isArray(body.productIds) ? body.productIds.filter((v: any) => typeof v === "string") : [];
      // 셀러 본인 소유 상품만 노출 대상으로 허용
      const owned = await prisma.directProduct.findMany({
        where: { sellerId: seller.id, id: { in: ids } },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((p) => p.id));
      data.productIds = JSON.stringify(ids.filter((id: string) => ownedIds.has(id)));
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "변경할 설정이 없습니다." }, { status: 400 });

    const saved = await (prisma as any).shopDirectProductExposure.upsert({
      where: { sellerProfileId: seller.id },
      create: {
        sellerProfileId: seller.id,
        isEnabled: data.isEnabled ?? false,
        productIds: data.productIds ?? null,
      },
      update: data,
    });

    return NextResponse.json({
      success: true,
      isEnabled: saved.isEnabled,
      productIds: (() => { try { return JSON.parse(saved.productIds || "[]"); } catch { return []; } })(),
    });
  } catch (e: any) {
    console.error("[shop-exposure PUT]", e?.message || e);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
