import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  isValidSellerSlug,
  linkReferralForNewBuyer,
} from "@/lib/referral";
import {
  generateUniqueSellerReferralCode,
  findMentorByReferralCode,
} from "@/lib/mentorReferral";
import { randomAvatar, pickRoleAvatar } from "@/lib/defaults";
import { getRegisterFieldSettings } from "@/lib/settings";
import { notifySignupWelcome } from "@/lib/alimtalkTriggers";

export async function POST(request: NextRequest) {
  try {
    const {
      name, email, password, role, gender, birthday, phone,
      zipCode, address1, address2,
      sellerRef: sellerRefFromBody, referralCode,
      // 셀러가입 추천인코드 (멘토-멘티 시스템)
      sellerReferralCode: sellerReferralCodeRaw,
    } = await request.json();

    // 셀러 귀속은 URL ?ref= 에서 전달된 body 값만 신뢰한다.
    const sellerRef: string | null =
      typeof sellerRefFromBody === "string" && isValidSellerSlug(sellerRefFromBody)
        ? sellerRefFromBody
        : null;

    // 회원가입 항목 권한 설정(필수/선택/숨김)
    const fieldSettings = await getRegisterFieldSettings();

    const nameTrimmed = typeof name === "string" ? name.trim() : "";
    const emailTrimmed = typeof email === "string" ? email.trim() : "";
    const phoneDigits = typeof phone === "string" ? phone.replace(/[^0-9]/g, "") : "";
    const address1Trimmed = typeof address1 === "string" ? address1.trim() : "";
    if (!nameTrimmed) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    if (!emailTrimmed) return NextResponse.json({ error: "이메일을 입력해주세요." }, { status: 400 });
    if (typeof password !== "string" || !password) return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
    if (fieldSettings.phone === "required" && !phoneDigits) return NextResponse.json({ error: "휴대전화번호를 입력해주세요." }, { status: 400 });
    if (fieldSettings.gender === "required" && gender !== "male" && gender !== "female") return NextResponse.json({ error: "성별을 선택해주세요." }, { status: 400 });
    if (fieldSettings.birthday === "required" && (typeof birthday !== "string" || !birthday.trim())) return NextResponse.json({ error: "생년월일을 입력해주세요." }, { status: 400 });
    if (fieldSettings.address === "required" && !address1Trimmed) return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: emailTrimmed } });
    if (existing) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userRole = role === "SELLER" ? "SELLER" : "BUYER";

    const genderPick = gender === "male" || gender === "female"
      ? gender
      : Math.random() < 0.5 ? "male" : "female";
    const phoneNormalized = typeof phone === "string" && phone.trim() ? phone.replace(/[^0-9]/g, "") : null;
    const birthdayValue = typeof birthday === "string" && birthday.trim() ? birthday.trim() : null;
    const zipCodeValue = typeof zipCode === "string" && zipCode.trim() ? zipCode.trim() : null;
    const address1Value = address1Trimmed || null;
    const address2Value = typeof address2 === "string" && address2.trim() ? address2.trim() : null;

    // 셀러 가입 시 멘토 찾기
    let mentorId: string | null = null;
    let mentorReferralCodeSaved: string | null = null;
    if (userRole === "SELLER" && typeof sellerReferralCodeRaw === "string" && sellerReferralCodeRaw.trim()) {
      const codeInput = sellerReferralCodeRaw.trim().toUpperCase();
      const mentor = await findMentorByReferralCode(prisma, codeInput);
      if (mentor) {
        mentorId = mentor.id;
        mentorReferralCodeSaved = codeInput;
      }
    }

    // 셀러 가입 시 추천인코드 자동 발급
    let newSellerReferralCode: string | undefined;
    if (userRole === "SELLER") {
      newSellerReferralCode = await generateUniqueSellerReferralCode(prisma);
    }

    // 1) User 생성
    const user = await (prisma as any).user.create({
      data: {
        name: nameTrimmed,
        email: emailTrimmed,
        password: hashedPassword,
        role: userRole,
        isActive: true,
        gender: genderPick,
        phone: phoneNormalized,
        birthday: birthdayValue,
        zipCode: zipCodeValue,
        address1: address1Value,
        address2: address2Value,
        avatar: userRole === "SELLER"
          ? pickRoleAvatar(emailTrimmed, "SELLER")
          : randomAvatar(genderPick),
        // 셀러 추천인코드 필드
        ...(userRole === "SELLER" && {
          sellerReferralCode: newSellerReferralCode,
          referredBySellerCode: mentorReferralCodeSaved,
          mentorId,
        }),
        ...(userRole === "SELLER" && {
          sellerProfile: {
            create: {
              slug: emailTrimmed.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-"),
              shopName: `${nameTrimmed}의 샵`,
              isApproved: false,
            },
          },
        }),
      },
    });

    // 2) BUYER 일 때만 구매자 추천인 매핑
    if (userRole === "BUYER") {
      await linkReferralForNewBuyer(prisma, {
        userId: user.id,
        sellerRef,
        referralCode: typeof referralCode === "string" ? referralCode : null,
      });
      // 회원가입 환영 알림톡 — 카카오 승인 조건상 가입 즉시 1회만. 실패해도 가입 흐름에 영향 없음.
      await notifySignupWelcome({ name: nameTrimmed, phone: phoneNormalized, sellerRef }).catch((e) =>
        console.error("[register] 환영 알림톡 오류:", e),
      );
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      role: userRole,
      message: userRole === "SELLER"
        ? "라이브 셀러 가입이 완료되었습니다. 관리자 승인 후 서비스를 이용할 수 있습니다."
        : "회원가입이 완료되었습니다. 바로 로그인하실 수 있습니다.",
      needsApproval: userRole === "SELLER",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
