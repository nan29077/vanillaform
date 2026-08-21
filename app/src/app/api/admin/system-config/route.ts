import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNodeEnabled, setNodeEnabled, getSellerOnlyFee, setSellerOnlyFee } from "@/lib/systemConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: 시스템 전역 스위치 조회 (최고관리자 전용)
export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }
    const [nodeEnabled, sellerOnlyFee] = await Promise.all([getNodeEnabled(), getSellerOnlyFee()]);
    return NextResponse.json({ nodeEnabled, sellerOnlyFee });
  } catch {
    return NextResponse.json({ error: "설정을 불러올 수 없습니다" }, { status: 500 });
  }
}

// PUT: nodeEnabled / sellerOnlyFee 저장 (최고관리자 전용)
// body: { nodeEnabled?: boolean, sellerOnlyFee?: boolean }
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json();
    const result: Record<string, boolean> = {};

    if (typeof body.nodeEnabled === "boolean") {
      result.nodeEnabled = await setNodeEnabled(body.nodeEnabled);
    } else {
      result.nodeEnabled = await getNodeEnabled();
    }
    if (typeof body.sellerOnlyFee === "boolean") {
      result.sellerOnlyFee = await setSellerOnlyFee(body.sellerOnlyFee);
    } else {
      result.sellerOnlyFee = await getSellerOnlyFee();
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "설정을 저장할 수 없습니다" }, { status: 500 });
  }
}
