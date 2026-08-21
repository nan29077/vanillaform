import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMentorByReferralCode } from "@/lib/mentorReferral";

/**
 * POST /api/auth/validate-referral
 * 셀러가입 추천인코드 유효성 검증
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false, error: "코드를 입력해주세요." }, { status: 400 });
    }

    const mentor = await findMentorByReferralCode(prisma, code);
    if (!mentor) {
      return NextResponse.json({ valid: false, error: "유효하지 않은 추천인코드입니다." });
    }

    return NextResponse.json({ valid: true, mentorName: mentor.name });
  } catch (e) {
    console.error("[validate-referral]", e);
    return NextResponse.json({ valid: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
