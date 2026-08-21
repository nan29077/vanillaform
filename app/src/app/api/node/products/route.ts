import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNodeEnabled } from "@/lib/systemConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 노드 권한 + 노드 시스템 활성화 확인 헬퍼
async function requireNode() {
  const session = await auth();
  if (!session || session.user.role !== "NODE") {
    return { error: NextResponse.json({ error: "권한이 없습니다" }, { status: 403 }) };
  }
  const nodeEnabled = await getNodeEnabled();
  if (!nodeEnabled) {
    return { error: NextResponse.json({ error: "노드 시스템이 비활성화되어 있습니다" }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

// 금액/비율 파싱: 비어있으면 null, 음수/NaN도 null
function toNumOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? null : n;
}

// GET: 노드로 들어온 상품 목록
//  - pending: 마진 설정 대기 (isApproved=false, nodeApprovedAt=null, 셀러 직접등록 제외)
//  - approved: 노드가 최종 등록함 → 최고관리자 승인 대기 (nodeApprovedAt!=null, isApproved=false)
export async function GET() {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  const [pending, approved] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        isApproved: false,
        nodeApprovedAt: null,
        sellerId: null,
      },
      include: {
        brand: { select: { brandName: true, middleAdminId: true } },
        middleAdmin: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        isApproved: false,
        nodeApprovedAt: { not: null },
      },
      include: {
        brand: { select: { brandName: true } },
        category: { select: { name: true } },
      },
      orderBy: { nodeApprovedAt: "desc" },
      take: 300,
    }),
  ]);

  const serialize = (p: any) => ({
    id: p.id,
    name: p.name,
    thumbnail: p.thumbnail,
    brandName: p.brand?.brandName || null,
    middleAdminName: (p as any).middleAdmin?.name || null,
    // 중간관리자 소속 여부: 상품 middleAdminId 또는 브랜드 middleAdminId
    viaMiddleAdmin: !!(p.middleAdminId || p.brand?.middleAdminId),
    categoryName: p.category?.name || null,
    supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
    basePrice: Number(p.basePrice),
    middleAdminMargin: p.middleAdminMargin != null ? Number(p.middleAdminMargin) : null,
    nodeMargin: p.nodeMargin != null ? Number(p.nodeMargin) : null,
    nodeMarginType: p.nodeMarginType || null,
    nodeApprovedAt: p.nodeApprovedAt ? p.nodeApprovedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  });

  return NextResponse.json({
    pending: pending.map(serialize),
    approved: approved.map(serialize),
  });
}

// POST: 노드 마진 설정 및 최종 등록
// body: { productId, nodeMargin, nodeMarginType: "AMOUNT"|"RATE", finalize?: boolean }
//  - finalize=false → 마진만 저장(임시)
//  - finalize=true  → 마진 저장 + nodeApprovedAt/nodeId 기록(최고관리자 승인 단계로 이동)
export async function POST(req: NextRequest) {
  const guard = await requireNode();
  if ("error" in guard) return guard.error;

  try {
    const body = await req.json();
    const { productId, nodeMargin, nodeMarginType, finalize } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId는 필수입니다" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isApproved: true, isActive: true, sellerId: true },
    });
    if (!product || !product.isActive || product.sellerId !== null) {
      return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
    }
    if (product.isApproved) {
      return NextResponse.json({ error: "이미 최고관리자 승인이 완료된 상품입니다" }, { status: 400 });
    }

    const data: any = {};
    if (nodeMargin !== undefined) data.nodeMargin = toNumOrNull(nodeMargin);
    if (nodeMarginType !== undefined) {
      data.nodeMarginType = nodeMarginType === "RATE" || nodeMarginType === "AMOUNT" ? nodeMarginType : null;
    }

    if (finalize) {
      data.nodeApprovedAt = new Date();
      data.nodeId = guard.userId;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data,
      select: { id: true, nodeMargin: true, nodeMarginType: true, nodeApprovedAt: true },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updated.id,
        nodeMargin: updated.nodeMargin != null ? Number(updated.nodeMargin) : null,
        nodeMarginType: updated.nodeMarginType || null,
        nodeApprovedAt: updated.nodeApprovedAt ? updated.nodeApprovedAt.toISOString() : null,
      },
    });
  } catch (e) {
    console.error("[node/products] error:", e);
    return NextResponse.json({ error: "상품 업데이트에 실패했습니다" }, { status: 500 });
  }
}
