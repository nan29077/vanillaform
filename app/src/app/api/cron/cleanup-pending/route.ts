import { NextResponse } from "next/server";
import { cleanupStalePendingOrders } from "@/lib/orderCleanup";

export const dynamic = "force-dynamic";

// 방치된 PENDING 주문 정리용 크론 엔드포인트.
// EC2 crontab 등에서 주기적으로 호출한다. 예) 5분마다:
//   */5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3026/api/cron/cleanup-pending
// CRON_SECRET 환경변수로 보호한다(미설정 시 비활성).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const provided = auth?.replace(/^Bearer\s+/i, "") || key;
  if (provided !== secret) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  }

  const deleted = await cleanupStalePendingOrders();
  return NextResponse.json({ ok: true, deleted });
}
