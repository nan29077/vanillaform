import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    const results: Record<string, number> = {};

    // 1. Create dummy seller users and profiles
    const sellerData = [
      { name: "김패션", email: "seller1@test.com", shopName: "패션이즈", slug: "fashion-is", category: "패션", mood: "트렌디한 스트릿 무드", desc: "트렌디한 스트릿 패션을 소개합니다. 매주 신상 업데이트!" },
      { name: "이뷰티", email: "seller2@test.com", shopName: "뷰티랩", slug: "beauty-lab", category: "뷰티", mood: "클린뷰티 전문가", desc: "클린뷰티와 스킨케어 전문 셀러입니다." },
      { name: "박리빙", email: "seller3@test.com", shopName: "리빙스토리", slug: "living-story", category: "홈리빙", mood: "미니멀 라이프", desc: "미니멀하고 감성적인 홈 인테리어 아이템을 소개합니다." },
      { name: "최푸드", email: "seller4@test.com", shopName: "델리셔스데이", slug: "delicious-day", category: "푸드", mood: "건강한 먹거리", desc: "건강하고 맛있는 식품을 엄선하여 공동구매합니다." },
      { name: "정키즈", email: "seller5@test.com", shopName: "리틀드림", slug: "little-dream", category: "키즈", mood: "아이와 함께하는 일상", desc: "안전하고 예쁜 키즈 아이템을 큐레이션합니다." },
    ];

    const hashedPw = await hash("test1234", 10);
    let sellerCount = 0;

    for (const sd of sellerData) {
      const existing = await prisma.user.findUnique({ where: { email: sd.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: sd.email,
            name: sd.name,
            password: hashedPw,
            role: "SELLER",
            isActive: true,
            sellerProfile: {
              create: {
                slug: sd.slug,
                shopName: sd.shopName,
                shopDescription: sd.desc,
                category: sd.category,
                mood: sd.mood,
                isApproved: true,
                totalFans: Math.floor(Math.random() * 5000) + 100,
                referralCode: `REF-${sd.slug.toUpperCase().replace(/-/g, "")}`,
              },
            },
          },
        });
        sellerCount++;
      }
    }
    results.sellers = sellerCount;

    // 2. Create dummy brand users and profiles
    const brandData = [
      { name: "매니저A", email: "brand1@test.com", brandName: "루미에르코스메틱", desc: "프리미엄 코스메틱 브랜드" },
      { name: "매니저B", email: "brand2@test.com", brandName: "어반스타일링", desc: "모던 패션 브랜드" },
      { name: "매니저C", email: "brand3@test.com", brandName: "네이처푸드", desc: "유기농 건강식품 브랜드" },
    ];

    let brandCount = 0;
    for (const bd of brandData) {
      const existing = await prisma.user.findUnique({ where: { email: bd.email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email: bd.email,
            name: bd.name,
            password: hashedPw,
            role: "BRAND_ADMIN",
            isActive: true,
            brandProfile: {
              create: {
                brandName: bd.brandName,
                description: bd.desc,
                isApproved: true,
                businessRegistrationNo: `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${String(Math.floor(Math.random() * 90000) + 10000)}`,
                representativeName: bd.name,
                contactEmail: bd.email,
              },
            },
          },
        });
        brandCount++;
      }
    }
    results.brands = brandCount;

    // 3. Create dummy buyer accounts
    const buyerData = [
      "김민수", "이서연", "박준혁", "최지원", "정하은", "강도현", "윤서윤", "임재호", "한소영", "조민서",
    ];
    let buyerCount = 0;
    for (let i = 0; i < buyerData.length; i++) {
      const email = `buyer${i + 1}@test.com`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: { email, name: buyerData[i], password: hashedPw, role: "BUYER", isActive: true },
        });
        buyerCount++;
      }
    }
    results.buyers = buyerCount;

    // 4. Create dummy orders if none exist
    const orderCount = await prisma.order.count();
    if (orderCount === 0) {
      const sellers = await prisma.sellerProfile.findMany({ take: 5 });
      const buyers = await prisma.user.findMany({ where: { role: "BUYER" }, take: 10 });
      const products = await prisma.product.findMany({ take: 20 });

      const statuses: any[] = ["PENDING", "PAID", "CONFIRMED", "SHIPPING", "DELIVERED"];
      let ordersCreated = 0;

      if (sellers.length > 0 && buyers.length > 0) {
        for (let i = 0; i < 20; i++) {
          const seller = sellers[i % sellers.length];
          const buyer = buyers[i % buyers.length];
          const product = products.length > 0 ? products[i % products.length] : null;
          const baseAmount = Math.floor(Math.random() * 150000) + 15000;
          const discountAmount = Math.floor(baseAmount * (Math.random() * 0.1));
          const finalAmount = baseAmount - discountAmount;
          const qty = Math.floor(Math.random() * 3) + 1;

          try {
            await prisma.order.create({
              data: {
                orderNumber: `ORD-2024-${String(i + 1).padStart(4, "0")}`,
                userId: buyer.id,
                sellerId: seller.id,
                totalAmount: baseAmount,
                discountAmount: discountAmount,
                finalAmount: finalAmount,
                status: statuses[i % statuses.length],
                shippingName: buyer.name,
                shippingPhone: `010-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                shippingAddress: ["서울시 강남구 테헤란로 123", "경기도 성남시 분당구 판교로 256", "서울시 마포구 홍대입구로 45"][i % 3],
                items: {
                  create: {
                    productId: product?.id || "dummy-product",
                    productName: product?.name || `테스트 상품 ${i + 1}`,
                    variantName: ["S / 블랙", "M / 화이트", "L / 네이비", "FREE", null][i % 5],
                    quantity: qty,
                    price: finalAmount,
                    totalPrice: finalAmount * qty,
                  },
                },
              },
            });
            ordersCreated++;
          } catch (e: any) {
            console.error(`Order ${i} failed:`, e.message);
          }
        }
      }
      results.orders = ordersCreated;
    } else {
      results.orders_existed = orderCount;
    }

    // 5. Create dummy settlements if none exist
    const settlementCount = await prisma.settlement.count();
    if (settlementCount === 0) {
      const sellers = await prisma.sellerProfile.findMany({ take: 5 });
      const sStatuses: any[] = ["PENDING", "CALCULATED", "APPROVED", "PAID"];
      let settlementsCreated = 0;

      for (let j = 0; j < 15; j++) {
        const seller = sellers[j % sellers.length];
        const totalSales = Math.floor(Math.random() * 5000000) + 200000;
        const commRate = 10 + Math.floor(Math.random() * 8);
        const commAmount = Math.floor(totalSales * commRate / 100);
        const periodStart = new Date(2024, j % 12, 1);
        const periodEnd = new Date(2024, (j % 12) + 1, 0);

        try {
          await prisma.settlement.create({
            data: {
              sellerId: seller.id,
              totalSales,
              commissionRate: commRate,
              commissionAmount: commAmount,
              settlementAmount: totalSales - commAmount,
              status: sStatuses[j % sStatuses.length],
              periodStart,
              periodEnd,
            },
          });
          settlementsCreated++;
        } catch (e: any) {
          console.error(`Settlement ${j} failed:`, e.message);
        }
      }
      results.settlements = settlementsCreated;
    } else {
      results.settlements_existed = settlementCount;
    }

    return NextResponse.json({
      message: "더미 데이터 생성 완료",
      ...results,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: error.message || "생성 실패" }, { status: 500 });
  }
}
