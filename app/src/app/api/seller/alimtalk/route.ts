import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 알림톡 발신 계정(API 키)은 관리자가 플랫폼 공용으로 관리한다.
// 셀러에게는 본인 명의로 나간 실발송 기록과 크레딧 정보만 노출한다.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    include: { sellerProfile: true },
  });
  if (!user?.sellerProfile) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const sellerId = user.sellerProfile.id;

  const [account, logs, totals] = await Promise.all([
    prisma.alimtalkAccount.findUnique({
      where: { sellerId },
      include: { charges: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.aligoSendLog.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.aligoSendLog.aggregate({
      where: { sellerId },
      _sum: { recipientCount: true, acceptedCount: true },
      _max: { createdAt: true },
    }),
  ]);

  return NextResponse.json({
    balance: account?.balance ?? 0,
    charges: account?.charges ?? [],
    logs: logs.map((l) => ({
      id: l.id,
      kind: l.kind,
      purpose: l.purpose,
      templateCode: l.templateCode,
      recipientCount: l.recipientCount,
      acceptedCount: l.acceptedCount,
      failCount: l.failCount,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    })),
    totalRecipients: totals._sum.recipientCount ?? 0,
    totalAccepted: totals._sum.acceptedCount ?? 0,
    lastSentAt: totals._max.createdAt,
  });
}
