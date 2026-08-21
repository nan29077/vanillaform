import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ALIMTALK_PURPOSES, sendTemplatedAlimtalk } from "@/lib/alimtalkEngine";
import { aligoConfig, normalizePhone, fetchAlimtalkDeliveryResult } from "@/lib/aligo";

// POST: 용도별 테스트 발송 { purpose, phone? }
// 접수 후 실제 전달 리포트(카카오 템플릿 검증 포함)까지 폴링해서 결과를 돌려준다.
// — "접수 성공 but 전달 실패(템플릿 불일치)"를 배포 전에 잡기 위한 장치.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== "SUPER_ADMIN" && role !== "MIDDLE_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { purpose } = body;
  const def = ALIMTALK_PURPOSES[purpose];
  if (!def) return NextResponse.json({ error: "알 수 없는 용도입니다." }, { status: 400 });

  const phone = normalizePhone(body.phone) || normalizePhone(aligoConfig.sender);
  if (!phone) return NextResponse.json({ error: "수신 번호가 없습니다." }, { status: 400 });

  const result = await sendTemplatedAlimtalk({
    purpose,
    variables: def.sampleVariables,
    recipients: [{ phone, name: "테스트" }],
  });

  if (!result.notified) {
    return NextResponse.json({ success: false, stage: "접수", message: result.reason || "발송 실패", result });
  }

  // 전달 리포트 폴링 (최대 ~21초)
  const mid = result.mids?.[0];
  if (mid) {
    for (let i = 0; i < 7; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const report = await fetchAlimtalkDeliveryResult(mid).catch(() => ({ done: false }) as const);
      if (report.done) {
        return NextResponse.json({
          success: Boolean(report.success),
          stage: "전달",
          message: report.success
            ? `전달 성공 — ${phone.replace(/^(\d{3})(\d+)(\d{4})$/, "$1****$3")} 카카오톡을 확인하세요.`
            : `접수는 됐지만 전달 실패: ${(report as any).resultMessage || "사유 미상"}`,
          result,
        });
      }
    }
  }
  return NextResponse.json({
    success: true,
    stage: "접수",
    message: "접수 성공. 전달 리포트가 아직 도착하지 않았습니다 — 잠시 후 발송 내역에서 확인하세요.",
    result,
  });
}
