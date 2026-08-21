import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    // Find sellers and buyers
    const sellers = await prisma.sellerProfile.findMany({
      take: 5,
      include: { campaigns: { take: 3, include: { product: true } }, shopProducts: { take: 5, include: { product: true } } },
    });
    const buyers = await prisma.user.findMany({
      where: { role: "BUYER" },
      take: 10,
    });
    const products = await prisma.product.findMany({ take: 20 });

    if (sellers.length === 0) {
      return NextResponse.json({ error: "라이브 셀러가 없습니다. 먼저 라이브 셀러를 등록하세요." }, { status: 400 });
    }

    const statuses: any[] = ["PENDING", "PAID", "CONFIRMED", "SHIPPING", "DELIVERED"];
    const createdOrders: string[] = [];
    const createdSettlements: string[] = [];

    // Generate dummy orders
    const buyerNames = ["김민수", "이서연", "박준혁", "최지원", "정하은", "강도현", "윤서윤", "임재호", "한소영", "조민서", "송유진", "오예진", "황지호", "배수빈", "남하린"];
    const productNames = ["오가닉 코튼 티셔츠", "프리미엄 데님 자켓", "캐시미어 니트", "실크 블라우스", "린넨 와이드팬츠",
      "레더 크로스백", "골드 이어링 세트", "퍼 머플러", "울 비니", "스웨이드 부츠",
      "센시블 향수 50ml", "비타민C 세럼", "히알루론산 크림", "클렌징 오일", "선스크린 SPF50"];

    for (let i = 0; i < 25; i++) {
      const seller = sellers[i % sellers.length];
      const buyer = buyers.length > 0 ? buyers[i % buyers.length] : null;
      const campaign = seller.campaigns.length > 0 ? seller.campaigns[i % seller.campaigns.length] : null;
      const product = campaign?.product || (products.length > 0 ? products[i % products.length] : null);
      const status = statuses[i % statuses.length];
      const baseAmount = Math.floor(Math.random() * 150000) + 10000;
      const discountAmount = Math.floor(baseAmount * (Math.random() * 0.15));
      const finalAmount = baseAmount - discountAmount;
      const quantity = Math.floor(Math.random() * 3) + 1;

      const orderData: any = {
        orderNumber: `ORD-${Date.now()}-${String(i + 1).padStart(3, "0")}`,
        userId: buyer?.id || seller.userId,
        sellerId: seller.id,
        campaignId: campaign?.id || null,
        totalAmount: baseAmount,
        discountAmount: discountAmount,
        finalAmount: finalAmount,
        status: status,
        shippingName: buyer?.name || buyerNames[i % buyerNames.length],
        shippingPhone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        shippingAddress: ["서울시 강남구 테헤란로 123", "경기도 성남시 분당구 판교로 256", "서울시 마포구 홍대입구로 45", "인천시 연수구 송도대로 100", "부산시 해운대구 마린시티로 67"][i % 5],
        items: {
          create: {
            productId: product?.id || products[0]?.id || "dummy",
            productName: product?.name || productNames[i % productNames.length],
            variantName: ["S", "M", "L", "XL", "FREE"][i % 5],
            quantity: quantity,
            price: finalAmount,
            totalPrice: finalAmount * quantity,
          },
        },
      };

      try {
        const order = await prisma.order.create({ data: orderData });
        createdOrders.push(order.id);
      } catch (e: any) {
        console.error(`Order ${i} failed:`, e.message);
      }
    }

    // Generate dummy settlements
    const settlementStatuses: any[] = ["PENDING", "CALCULATED", "APPROVED", "PAID", "PAID"];
    for (let j = 0; j < 12; j++) {
      const seller = sellers[j % sellers.length];
      const campaign = seller.campaigns.length > 0 ? seller.campaigns[j % seller.campaigns.length] : null;
      const totalSales = Math.floor(Math.random() * 5000000) + 100000;
      const commissionRate = 10 + Math.floor(Math.random() * 10);
      const commissionAmount = Math.floor(totalSales * commissionRate / 100);
      const settlementAmount = totalSales - commissionAmount;

      const periodStart = new Date(2024, j % 12, 1);
      const periodEnd = new Date(2024, (j % 12) + 1, 0);

      try {
        const settlement = await prisma.settlement.create({
          data: {
            sellerId: seller.id,
            campaignId: campaign?.id || null,
            totalSales: totalSales,
            commissionRate: commissionRate,
            commissionAmount: commissionAmount,
            settlementAmount: settlementAmount,
            status: settlementStatuses[j % settlementStatuses.length],
            periodStart,
            periodEnd,
          },
        });
        createdSettlements.push(settlement.id);
      } catch (e: any) {
        console.error(`Settlement ${j} failed:`, e.message);
      }
    }

    return NextResponse.json({
      message: "더미 데이터가 생성되었습니다",
      orders: createdOrders.length,
      settlements: createdSettlements.length,
    });
  } catch (error: any) {
    console.error("Seed data error:", error);
    return NextResponse.json({ error: error.message || "데이터 생성 실패" }, { status: 500 });
  }
}
