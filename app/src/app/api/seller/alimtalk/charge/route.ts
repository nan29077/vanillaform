import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    include: { sellerProfile: true },
  });
  if (!user?.sellerProfile) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

  const { amount, payMethod } = await request.json();

  if (!amount || amount < 50000) {
    return NextResponse.json({ error: "최소 충전 금액은 50,000원입니다." }, { status: 400 });
  }

  const vat = Math.round(amount * 0.1);
  const totalAmount = amount + vat;
  const credits = Math.floor(amount / 15);

  let account = await prisma.alimtalkAccount.findUnique({
    where: { sellerId: user.sellerProfile.id },
  });

  if (!account) {
    account = await prisma.alimtalkAccount.create({
      data: { sellerId: user.sellerProfile.id },
    });
  }

  const charge = await prisma.alimtalkCharge.create({
    data: {
      accountId: account.id,
      amount,
      vat,
      totalAmount,
      credits,
      payMethod: payMethod || "card",
      payStatus: "PAID",
      pgTid: `SIM_${Date.now()}`,
    },
  });

  await prisma.alimtalkAccount.update({
    where: { id: account.id },
    data: { balance: { increment: credits } },
  });

  const updated = await prisma.alimtalkAccount.findUnique({
    where: { id: account.id },
  });

  return NextResponse.json({ chargeId: charge.id, credits, balance: updated?.balance ?? 0 });
}
