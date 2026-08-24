import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PLATFORMS = ["YouTube", "Instagram", "TikTok", "Facebook"];

interface SnsAccount {
  platform: string;
  handle: string;
}

// 구매자 SNS 채널 정보(단일) — 구매 시 선택 입력
function cleanStr(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

// 소셜주문서 제출
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, sellerId, name, address, phone } = body || {};
    const snsAccountsRaw: SnsAccount[] = Array.isArray(body?.snsAccounts) ? body.snsAccounts : [];

    if (!productId || !sellerId || !name || !address || !phone) {
      return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    // 입금자명 (미입력 시 주문자명으로 대체)
    const depositorName = String(body?.depositorName || "").trim() || String(name).trim();

    // SNS 계정 정제 (허용 플랫폼 + handle 비어있지 않은 것만)
    const snsAccounts = snsAccountsRaw
      .filter((s) => s && PLATFORMS.includes(s.platform) && String(s.handle || "").trim())
      .map((s) => ({ platform: s.platform, handle: String(s.handle).trim() }));

    const created = await prisma.socialOrder.create({
      data: {
        productId: String(productId),
        sellerId: String(sellerId),
        name: String(name).trim(),
        address: String(address).trim(),
        phone: String(phone).trim(),
        depositorName,
        snsAccounts: JSON.stringify(snsAccounts),
        snsPlatform: cleanStr(body?.snsPlatform, 50),
        snsHandle: cleanStr(body?.snsHandle, 191),
        snsNickname: cleanStr(body?.snsNickname, 100),
      },
    });

    return NextResponse.json({ id: created.id, success: true }, { status: 201 });
  } catch (e: any) {
    console.error("[social-orders POST]", e?.message || e);
    return NextResponse.json({ error: "소셜주문서 저장에 실패했습니다." }, { status: 500 });
  }
}

// 소셜주문서 조회 (?sellerId=xxx [&productId=xxx])
//
// 반환값에 구매자 실명·주소·연락처가 그대로 담기므로 인증·소유권 검사가 필수다.
// (과거엔 인증이 전혀 없어 sellerId 만 알면 누구나 전 구매자 개인정보를 조회할 수 있었다)
//  - SELLER                     : 본인 sellerId 의 주문서만
//  - SUPER_ADMIN / MIDDLE_ADMIN : 임의 셀러 조회 허용 (CS·정산 확인용)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("sellerId");
    const productId = searchParams.get("productId");

    if (!sellerId) {
      return NextResponse.json({ error: "sellerId가 필요합니다." }, { status: 400 });
    }

    const role = (session.user as any).role as string;
    if (role === "SELLER") {
      const seller = await prisma.sellerProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!seller || seller.id !== sellerId) {
        return NextResponse.json({ error: "본인 샵의 주문서만 조회할 수 있습니다." }, { status: 403 });
      }
    } else if (role !== "SUPER_ADMIN" && role !== "MIDDLE_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const rows = await prisma.socialOrder.findMany({
      where: { sellerId, ...(productId ? { productId } : {}) },
      orderBy: { createdAt: "desc" },
    });

    // 상품명·가격 매핑
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, basePrice: true } })
      : [];
    const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const priceMap = Object.fromEntries(products.map((p) => [p.id, Number(p.basePrice)]));

    const orders = rows.map((r) => {
      let snsAccounts: SnsAccount[] = [];
      try {
        snsAccounts = r.snsAccounts ? JSON.parse(r.snsAccounts) : [];
      } catch {
        snsAccounts = [];
      }
      return {
        id: r.id,
        productId: r.productId,
        productName: nameMap[r.productId] || "(삭제된 상품)",
        price: priceMap[r.productId] ?? 0,
        name: r.name,
        address: r.address,
        phone: r.phone,
        depositorName: r.depositorName || r.name,
        snsAccounts,
        snsPlatform: r.snsPlatform || null,
        snsHandle: r.snsHandle || null,
        snsNickname: r.snsNickname || null,
        status: r.status || null,
        quantity: r.quantity != null ? Number(r.quantity) : 1,
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
      };
    });

    return NextResponse.json({ orders });
  } catch (e: any) {
    console.error("[social-orders GET]", e?.message || e);
    return NextResponse.json({ error: "소셜주문서 조회에 실패했습니다." }, { status: 500 });
  }
}

// 소셜주문서 삭제 (셀러 본인 것만, 선택/전체)
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    if ((session.user as any).role !== "SELLER") {
      return NextResponse.json({ error: "셀러만 삭제할 수 있습니다." }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id as string },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "셀러 정보를 찾을 수 없습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "삭제할 항목이 없습니다." }, { status: 400 });
    }

    // 반드시 이 셀러의 소셜주문서만 삭제 (sellerId 조건으로 소유권 보장)
    const result = await prisma.socialOrder.deleteMany({
      where: { id: { in: ids }, sellerId: seller.id },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (e: any) {
    console.error("[social-orders DELETE]", e?.message || e);
    return NextResponse.json({ error: "소셜주문서 삭제에 실패했습니다." }, { status: 500 });
  }
}
