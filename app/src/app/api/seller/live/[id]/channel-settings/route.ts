import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: 채널 OFF 썸네일·링크 설정 (셀러 본인 라이브만)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

    const role = (session.user as any)?.role;
    if (role !== "SELLER") return NextResponse.json({ error: "셀러만 가능합니다" }, { status: 403 });

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: { id: true },
    });
    if (!seller) return NextResponse.json({ error: "셀러 프로필 없음" }, { status: 404 });

    const live = await prisma.liveStream.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true },
    });
    if (!live || live.sellerId !== seller.id) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const body = await req.json();
    const data: { offThumbnailUrl?: string | null; offLinkUrl?: string | null; offLinkText?: string | null } = {};

    if (Object.prototype.hasOwnProperty.call(body, "offThumbnailUrl")) {
      data.offThumbnailUrl =
        typeof body.offThumbnailUrl === "string" && body.offThumbnailUrl.trim().length > 0
          ? body.offThumbnailUrl.trim()
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "offLinkUrl")) {
      data.offLinkUrl =
        typeof body.offLinkUrl === "string" && body.offLinkUrl.trim().length > 0
          ? body.offLinkUrl.trim()
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "offLinkText")) {
      data.offLinkText =
        typeof body.offLinkText === "string" && body.offLinkText.trim().length > 0
          ? body.offLinkText.trim()
          : "자세히 보기";
    }

    const updated = await prisma.liveStream.update({ where: { id: live.id }, data });
    return NextResponse.json({
      live: {
        id: updated.id,
        offThumbnailUrl: updated.offThumbnailUrl,
        offLinkUrl: updated.offLinkUrl,
        offLinkText: updated.offLinkText,
      },
    });
  } catch (error) {
    console.error("채널 설정 저장 오류:", error);
    return NextResponse.json({ error: "채널 설정 저장에 실패했습니다." }, { status: 500 });
  }
}
