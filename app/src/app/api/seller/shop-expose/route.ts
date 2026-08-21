import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 셀러: "샵에 바로 노출하기" / "상품 번호 매기기" 설정 + 상품별 번호 저장.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SELLER") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: session!.user!.id }, select: { id: true } });
  if (!seller) return NextResponse.json({ error: "라이브 셀러 정보를 찾을 수 없습니다." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // 1) 상품 번호 저장 (중복 검증)
  if (Array.isArray(body.numbers)) {
    const entries: { id: string; shopNumber: number | null }[] = body.numbers
      .filter((n: any) => typeof n?.id === "string")
      .map((n: any) => ({
        id: n.id as string,
        shopNumber: n.shopNumber === null || n.shopNumber === "" || n.shopNumber === undefined ? null : Number(n.shopNumber),
      }));

    // 중복 번호 검증 (null 제외)
    const used = new Map<number, number>();
    for (const e of entries) {
      if (e.shopNumber === null || Number.isNaN(e.shopNumber)) continue;
      used.set(e.shopNumber, (used.get(e.shopNumber) ?? 0) + 1);
    }
    const dup = [...used.entries()].filter(([, c]) => c > 1).map(([num]) => num);
    if (dup.length > 0) {
      return NextResponse.json({ error: `중복된 번호가 있습니다: ${dup.join(", ")}` }, { status: 400 });
    }

    await prisma.$transaction(
      entries.map((e) =>
        prisma.sellerShopProduct.updateMany({
          where: { id: e.id, sellerId: seller.id },
          data: { shopNumber: e.shopNumber === null || Number.isNaN(e.shopNumber) ? null : e.shopNumber },
        }),
      ),
    );
    return NextResponse.json({ success: true });
  }

  // 2) 토글 저장
  const data: { shopDirectExpose?: boolean; shopNumbering?: boolean } = {};
  if (typeof body.shopDirectExpose === "boolean") data.shopDirectExpose = body.shopDirectExpose;
  if (typeof body.shopNumbering === "boolean") data.shopNumbering = body.shopNumbering;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "변경할 설정이 없습니다." }, { status: 400 });
  }
  await prisma.sellerProfile.update({ where: { id: seller.id }, data });
  return NextResponse.json({ success: true, ...data });
}
