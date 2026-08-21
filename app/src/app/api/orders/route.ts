import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeSellerMargin } from "@/lib/margin";
import { computeOrderShipping } from "@/lib/shipping";
import { getPlatformFees, productSettlementRecipient } from "@/lib/settlement";
import { reserveStockInTx, StockShortageError, type StockOp } from "@/lib/orderStock";


export const dynamic = "force-dynamic";

// 주문 목록 조회
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const role = session.user.role;
  const where: any = {};

  if (role === "BUYER") {
    where.userId = session.user!.id;
  } else if (role === "SELLER") {
    // 셀러: 자신의 샵(자신이 등록·판매한 상품)의 주문만
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
    });
    where.sellerId = seller?.id ?? "__none__";
  } else if (role === "BRAND_ADMIN") {
    // 브랜드사: 자사 상품이 포함된 주문만
    const brand = await prisma.brandProfile.findUnique({
      where: { userId: session.user!.id },
      include: { products: { select: { id: true } } },
    });
    const productIds = brand?.products.map((p) => p.id) ?? [];
    where.items = { some: { productId: { in: productIds.length ? productIds : ["__none__"] } } };
  } else if (role === "MIDDLE_ADMIN") {
    // 중간관리자: 소속 셀러의 주문 + 소속 브랜드 상품이 포함된 주문
    const middle = await prisma.middleAdminProfile.findUnique({
      where: { userId: session.user!.id },
      include: { sellers: { select: { id: true } }, brands: { select: { products: { select: { id: true } } } } },
    });
    const sellerIds = middle?.sellers.map((s) => s.id) ?? [];
    const brandProductIds = middle?.brands.flatMap((b) => b.products.map((p) => p.id)) ?? [];
    where.OR = [
      ...(sellerIds.length ? [{ sellerId: { in: sellerIds } }] : []),
      ...(brandProductIds.length ? [{ items: { some: { productId: { in: brandProductIds } } } }] : []),
      ...(!sellerIds.length && !brandProductIds.length ? [{ id: "__none__" }] : []),
    ];
  }
  // SUPER_ADMIN: where 비움 = 전체 주문

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { shopName: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
      shippingFee: Number(o.shippingFee),
      discountAmount: Number(o.discountAmount),
      finalAmount: Number(o.finalAmount),
      items: o.items.map((item) => ({
        ...item,
        price: Number(item.price),
        totalPrice: Number(item.totalPrice),
      })),
    })),
  });
}

// 주문 생성
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const {
    sellerId,
    campaignId,
    items,
    shippingName,
    shippingPhone,
    shippingAddress,
    shippingMemo,
    snsAccounts,
    couponCode,
  } = body;

  // SNS 계정 (선택사항) — { platform, handle }[] 형태만 허용. 없으면 null 저장.
  let snsAccountsJson: string | null = null;
  if (Array.isArray(snsAccounts) && snsAccounts.length > 0) {
    const cleaned = snsAccounts
      .filter(
        (s: any) =>
          s && typeof s.platform === "string" && typeof s.handle === "string" && s.handle.trim()
      )
      .map((s: any) => ({ platform: String(s.platform), handle: String(s.handle).trim() }));
    if (cleaned.length > 0) snsAccountsJson = JSON.stringify(cleaned);
  }

  if (!sellerId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "주문 정보가 올바르지 않습니다." }, { status: 400 });
  }

  // 셀러 존재 확인 (할인/커미션 계산에도 재사용)
  const seller = await prisma.sellerProfile.findUnique({
    where: { id: sellerId },
  });
  if (!seller) {
    return NextResponse.json({ error: "라이브 셀러를 찾을 수 없습니다." }, { status: 404 });
  }

  // ─── 캠페인 검증 (가격은 서버 campaignPrice 만 신뢰) ───
  // 종료/취소/예정 캠페인 차단, 기간 검증.
  let campaign: Awaited<ReturnType<typeof prisma.groupBuyCampaign.findUnique>> = null;
  if (campaignId) {
    campaign = await prisma.groupBuyCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) {
      return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });
    }
    if (campaign.sellerId !== sellerId) {
      return NextResponse.json({ error: "캠페인 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const nowTs = new Date();
    const started = campaign.startDate <= nowTs;
    const notEnded = campaign.endDate >= nowTs;
    if (campaign.status !== "ACTIVE" || !started || !notEnded) {
      return NextResponse.json({ error: "진행 중인 공동구매가 아닙니다." }, { status: 400 });
    }
  }

  // 주문번호 생성
  const now = new Date();
  const orderNumber = `SB${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // ─── 정산 스냅샷용 요율 (주문 시점 고정) ───
  // 셀러 개별 요율이 있으면 우선, 없으면 전역 플랫폼 요율. settlement.ts 의 판정과 동일하게 맞춘다.
  const platformFees = await getPlatformFees();
  const sellerFeeRateSnap =
    seller.commissionRate != null ? Number(seller.commissionRate) : platformFees.sellerFeeRate;

  // ─── 금액 계산: 가격·상품명은 전부 서버 DB 기준. 클라이언트 price/productName 무시. ───
  let totalAmount = 0;
  const orderItems: any[] = [];
  // 중간관리자 브랜드 마진 적립용 — 상품별 브랜드/마진 스냅샷 (OrderItem 에는 저장하지 않음)
  const marginItems: {
    brandId: string | null;
    brandMiddleAdminId: string | null;
    unitMargin: number; // product.middleAdminMargin (단가 기준 스냅샷)
    quantity: number;
    saleAmount: number; // 판매가 × 수량
  }[] = [];
  // 배송비 계산용 — 주문에 포함된 상품들의 배송 설정
  const shippingConfigs: { shippingFee: number; freeShipping: boolean; freeShippingThreshold: number | null }[] = [];
  // 재고 선점 대상 — 주문 생성 트랜잭션 안에서 조건부 UPDATE 로 원자적으로 차감한다.
  // 일반상품(DirectProduct)·카탈로그 상품(Product)·옵션(ProductVariant)을 함께 담는다.
  // 아래 루프의 재고 비교는 "빠른 실패 + 남은 수량 안내"용일 뿐, 오버셀을 막는 건 이 선점이다.
  const stockOps: StockOp[] = [];

  for (const item of items) {
    // 수량 검증 — 양의 정수만 허용 (API 직접 호출 방어)
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) {
      return NextResponse.json({ error: "주문 수량이 올바르지 않습니다." }, { status: 400 });
    }
    if (!item.productId) {
      return NextResponse.json({ error: "상품 정보가 올바르지 않습니다." }, { status: 400 });
    }

    // ─── 셀러 일반상품(DirectProduct) ───
    // 카탈로그 Product 가 아닌 별도 모델이라 조회·검증·정산 스냅샷 경로가 다르다.
    // 옵션(variant)·공동구매·공급자가 존재하지 않는다.
    if (item.itemType === "DIRECT") {
      const direct = await prisma.directProduct.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, shippingFee: true, stock: true, isActive: true, sellerId: true },
      });
      if (!direct || !direct.isActive) {
        return NextResponse.json({ error: "판매 중이 아닌 상품이 포함되어 있습니다." }, { status: 400 });
      }
      // 소유권 검증 — 다른 셀러의 일반상품을 이 셀러 주문으로 태우면 정산이 엉뚱한 셀러에게 귀속된다.
      if (direct.sellerId !== sellerId) {
        return NextResponse.json({ error: "상품 정보가 올바르지 않습니다." }, { status: 400 });
      }
      if (campaign) {
        return NextResponse.json({ error: "일반상품은 공동구매로 주문할 수 없습니다." }, { status: 400 });
      }
      if (direct.stock < quantity) {
        return NextResponse.json({ error: `재고가 부족합니다. (남은 수량: ${direct.stock})` }, { status: 400 });
      }

      const price = Number(direct.price); // 가격은 서버 DB 값만 신뢰 (클라이언트 price 무시)
      const itemTotal = price * quantity;
      totalAmount += itemTotal;

      // 정산 스냅샷 — 셀러가 직접 등록·판매하는 상품이므로 settlement.ts 의 Case 1 로 계산된다.
      // (정산액 = 판매가 × (1 - 셀러 플랫폼 수수료율 × 1.1 / 100), 공급자 몫 없음)
      orderItems.push({
        itemType: "DIRECT",
        productId: direct.id,
        variantId: null,
        productName: direct.name,
        variantName: null,
        price,
        quantity,
        totalPrice: itemTotal,
        supplyPriceSnap: null,
        priceModelSnap: "DIRECT",
        productCommissionRateSnap: null,
        sellerFeeRateSnap,
        supplierFeeRateSnap: null,
        isSellerProductSnap: true,
        recipientRole: "SELLER",
        recipientId: sellerId,
      });

      stockOps.push({ itemType: "DIRECT", productId: direct.id, variantId: null, quantity });

      // DirectProduct 에는 무료배송 기준금액 개념이 없다 — 배송비 0원이면 무료배송.
      const directShippingFee = Number(direct.shippingFee);
      shippingConfigs.push({
        shippingFee: directShippingFee,
        freeShipping: directShippingFee === 0,
        freeShippingThreshold: null,
      });

      // 공급자·브랜드가 없으므로 중간관리자 브랜드 마진 적립 대상이 아니다.
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        basePrice: true,
        isActive: true,
        totalStock: true,
        // ─── 배송비 계산용 ───
        shippingFee: true,
        freeShipping: true,
        freeShippingThreshold: true,
        // ─── 중간관리자 브랜드 마진 적립용 ───
        brandId: true,
        middleAdminMargin: true,
        brand: { select: { middleAdminId: true } },
        // ─── 정산 스냅샷용 ───
        supplyPrice: true,
        priceModel: true,
        commissionRate: true,
        sellerId: true,
        middleAdminId: true,
      },
    });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "판매 중이 아닌 상품이 포함되어 있습니다." }, { status: 400 });
    }

    // variant 검증 — 존재 + 해당 상품 소속 + 재고
    let variant: { id: string; name: string; price: any; stock: number; isActive: boolean } | null = null;
    if (item.variantId) {
      const v = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        select: { id: true, name: true, price: true, stock: true, isActive: true, productId: true },
      });
      if (!v || v.productId !== product.id || !v.isActive) {
        return NextResponse.json({ error: "선택한 옵션을 찾을 수 없습니다." }, { status: 400 });
      }
      variant = v;
    }

    // 캠페인 상품 정합성 — 캠페인의 productId 와 주문 상품이 일치해야 함
    if (campaign && campaign.productId !== product.id) {
      return NextResponse.json({ error: "공동구매 상품 정보가 올바르지 않습니다." }, { status: 400 });
    }

    // 재고 검증 — variant 가 있으면 variant.stock, 없으면 product.totalStock
    // (여기서 통과해도 실제 차감은 트랜잭션 안의 조건부 UPDATE 가 다시 확인한다)
    const availableStock = variant ? variant.stock : product.totalStock;
    if (availableStock < quantity) {
      return NextResponse.json({ error: `재고가 부족합니다. (남은 수량: ${availableStock})` }, { status: 400 });
    }
    stockOps.push({
      itemType: "PRODUCT",
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
    });

    // 가격 우선순위: 캠페인가 > variant가 > 기본가 (checkout/page.tsx 와 동일, 전부 서버 값)
    const price = campaign
      ? Number(campaign.campaignPrice)
      : variant
      ? Number(variant.price)
      : Number(product.basePrice);
    const itemTotal = price * quantity;
    totalAmount += itemTotal;

    // 정산 스냅샷 — 이 시점의 요율·공급가·수취인을 고정 저장한다.
    // 이후 상품의 공급가/요율/소유자가 바뀌거나 상품이 삭제돼도 이 주문의 정산액은 불변.
    const recipient = productSettlementRecipient(product);
    orderItems.push({
      itemType: "PRODUCT",
      productId: product.id,
      variantId: variant?.id || null,
      productName: product.name,
      variantName: variant?.name || null,
      price,
      quantity,
      totalPrice: itemTotal,
      supplyPriceSnap: product.supplyPrice != null ? Number(product.supplyPrice) : null,
      priceModelSnap: String(product.priceModel),
      productCommissionRateSnap:
        product.commissionRate != null ? Number(product.commissionRate) : null,
      sellerFeeRateSnap,
      supplierFeeRateSnap: product.middleAdminId
        ? platformFees.middleAdminFeeRate
        : platformFees.brandFeeRate,
      isSellerProductSnap: product.sellerId === sellerId,
      recipientRole: recipient?.role ?? null,
      recipientId: recipient?.id ?? null,
    });

    // 배송 설정 누적 (묶음배송: 상품별 배송비 최댓값을 한 번만 부과)
    shippingConfigs.push({
      shippingFee: Number(product.shippingFee),
      freeShipping: product.freeShipping,
      freeShippingThreshold: product.freeShippingThreshold != null ? Number(product.freeShippingThreshold) : null,
    });

    // 중간관리자 브랜드 마진 스냅샷 누적
    marginItems.push({
      brandId: product.brandId,
      brandMiddleAdminId: product.brand?.middleAdminId ?? null,
      unitMargin: Number(product.middleAdminMargin ?? 0),
      quantity,
      saleAmount: itemTotal,
    });
  }

  // ─── 할인 계산 ───
  // 추천인/픽(채널인증) 할인은 2026-07 폐지 — 장바구니 할인(셀러 부담)만 적용한다.
  // discountAmount/discountType 변수는 쿠폰 로직과 주문 저장 형식 호환을 위해 유지.
  // (buyerProfile 은 추천인 커미션 산정에 계속 사용된다)
  let discountAmount = 0;
  let discountType: string | null = null;

  const buyerProfile = await prisma.buyerProfile.findUnique({
    where: { userId: session.user!.id },
  });

  // ─── 장바구니 할인 (셀러 부담) ───
  // 셀러별 소계(배송비 제외)가 기준금액 이상이면 % 할인.
  // 할인액은 별도 컬럼(cartDiscountAmount)에 기록해 셀러 정산에서 차감한다 (lib/settlement.ts).
  let cartDiscountAmount = 0;
  if (
    seller.cartDiscountEnabled &&
    Number(seller.cartDiscountRate) > 0 &&
    Number(seller.cartDiscountThreshold) > 0 &&
    totalAmount >= Number(seller.cartDiscountThreshold)
  ) {
    cartDiscountAmount = Math.round((totalAmount * Number(seller.cartDiscountRate)) / 100);
    if (cartDiscountAmount > 0) discountType = "cart";
  }

  // ─── 라이브 쿠폰 할인 ───
  let couponDiscountAmount = 0;
  let appliedCouponId: string | null = null;
  let existingUserCouponId: string | null = null;

  if (couponCode && typeof couponCode === "string") {
    const coupon = await prisma.liveCoupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
      include: { liveStream: { select: { endedAt: true } } },
    });

    if (coupon) {
      // 만료 여부
      let expired = false;
      if (coupon.liveStream.endedAt) {
        const expiry = new Date(coupon.liveStream.endedAt);
        expiry.setDate(expiry.getDate() + coupon.validDays);
        if (expiry < new Date()) expired = true;
      }

      if (!expired) {
        const existingUserCoupon = await prisma.userCoupon.findUnique({
          where: { liveCouponId_userId: { liveCouponId: coupon.id, userId: session.user!.id } },
        });

        const alreadyUsed = !!existingUserCoupon?.usedAt;
        const countExceeded = !existingUserCoupon && coupon.maxCount !== null && coupon.issuedCount >= coupon.maxCount;
        const minAmountOk = !coupon.minOrderAmount || totalAmount >= Number(coupon.minOrderAmount);

        if (!alreadyUsed && !countExceeded && minAmountOk) {
          if (coupon.discountType === "PERCENT") {
            couponDiscountAmount = Math.round(totalAmount * Number(coupon.discountValue) / 100);
          } else {
            couponDiscountAmount = Math.min(Number(coupon.discountValue), totalAmount - discountAmount - cartDiscountAmount);
          }
          appliedCouponId = coupon.id;
          existingUserCouponId = existingUserCoupon?.id ?? null;
        }
      }
    }
  }

  // ─── 게임 당첨 쿠폰 할인 (라이브 쿠폰이 적용되지 않은 경우) ───
  let appliedGameCouponRowId: string | null = null;
  if (!appliedCouponId && couponCode && typeof couponCode === "string") {
    const gc = await prisma.userGameCoupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
      include: { gameCoupon: { select: { discountType: true, discountValue: true, minOrderAmount: true } } },
    });
    if (
      gc &&
      gc.userId === session.user!.id &&
      !gc.usedAt &&
      gc.expiresAt >= new Date() &&
      gc.sellerId === sellerId // 발급 셀러 샵에서만 사용 가능
    ) {
      const minOrder = Number(gc.gameCoupon?.minOrderAmount ?? 0);
      if (!minOrder || totalAmount >= minOrder) {
        if (gc.gameCoupon?.discountType === "PERCENT") {
          couponDiscountAmount = Math.round((totalAmount * Number(gc.gameCoupon.discountValue)) / 100);
        } else {
          couponDiscountAmount = Math.min(Number(gc.gameCoupon?.discountValue ?? 0), totalAmount - discountAmount - cartDiscountAmount);
        }
        appliedGameCouponRowId = gc.id;
      }
    }
  }
  const anyCouponApplied = !!appliedCouponId || !!appliedGameCouponRowId;

  // 배송비: 상품 배송 설정 기준 (무료배송/기준금액 반영). 소계는 할인 전 금액 기준.
  const shippingFee = computeOrderShipping(shippingConfigs, totalAmount);
  const totalDiscountAmount = discountAmount + couponDiscountAmount;
  const finalAmount = totalAmount - totalDiscountAmount - cartDiscountAmount + shippingFee;
  const totalQty = orderItems.reduce((acc: number, i: any) => acc + i.quantity, 0);

  // 셀러의 멘토 정보 조회 (멘토-멘티 추천인 커미션)
  let mentorCommissionData: {
    mentorId: string;
    menteeId: string;
    commissionRate: number;
    commissionAmount: number;
  } | null = null;
  try {
    const sellerUser = await (prisma as any).user.findUnique({
      where: { id: seller.userId },
      select: { mentorId: true },
    });
    if (sellerUser?.mentorId) {
      const feeRow = await (prisma as any).platformFeeSettings.findFirst({ orderBy: { id: "asc" } });
      const mentorRate = Number(feeRow?.mentorCommissionRate ?? 1);
      if (mentorRate > 0) {
        const mentorCommAmount = Math.round(finalAmount * mentorRate / 100);
        if (mentorCommAmount > 0) {
          mentorCommissionData = {
            mentorId: sellerUser.mentorId,
            menteeId: seller.userId,
            commissionRate: mentorRate,
            commissionAmount: mentorCommAmount,
          };
        }
      }
    }
  } catch (e) {
    console.error("[orders] 멘토 커미션 산정 실패:", e);
  }

  // 커미션 대상 셀러는 트랜잭션 밖에서 미리 조회 (읽기) — 쓰기만 원자적으로 묶는다.
  let commission: {
    sellerId: string;
    commRate: number;
    commAmount: number;
  } | null = null;
  if (buyerProfile?.referredBySellerId) {
    const referredSeller = await prisma.sellerProfile.findUnique({
      where: { id: buyerProfile.referredBySellerId },
      select: { id: true, referralCommissionRate: true },
    });
    if (referredSeller) {
      const commRate = Number(referredSeller.referralCommissionRate);
      const commAmount = Math.round(totalAmount * commRate / 100);
      if (commAmount > 0) {
        commission = { sellerId: referredSeller.id, commRate, commAmount };
      }
    }
  }

  // ─── 중간관리자 마진 적립 레코드 사전 산정 (읽기는 트랜잭션 밖, 쓰기는 안에서) ───
  // 경로 1) 브랜드 마진: 브랜드의 중간관리자별로 (middleAdminId, brandId) 합산.
  //   marginAmount = Σ(product.middleAdminMargin × quantity), orderAmount = Σ(판매매출)
  // 경로 2) 셀러 마진: 셀러의 중간관리자에게 computeSellerMargin(주문 판매매출, rate) 1건.
  const middleAdminCommissions: {
    middleAdminId: string;
    source: "brand" | "seller";
    brandId: string | null;
    sellerId: string | null;
    orderAmount: number;
    marginAmount: number;
  }[] = [];

  try {
    // 경로 1) 브랜드 마진 — (middleAdminId|brandId) 키로 합산
    const brandAgg = new Map<
      string,
      { middleAdminId: string; brandId: string; orderAmount: number; marginAmount: number }
    >();
    for (const mi of marginItems) {
      if (!mi.brandMiddleAdminId || !mi.brandId) continue;
      if (mi.unitMargin <= 0) continue;
      const key = `${mi.brandMiddleAdminId}|${mi.brandId}`;
      const cur =
        brandAgg.get(key) ??
        { middleAdminId: mi.brandMiddleAdminId, brandId: mi.brandId, orderAmount: 0, marginAmount: 0 };
      cur.orderAmount += mi.saleAmount;
      cur.marginAmount += mi.unitMargin * mi.quantity;
      brandAgg.set(key, cur);
    }
    for (const v of brandAgg.values()) {
      if (v.marginAmount <= 0) continue; // 0 이면 skip
      middleAdminCommissions.push({
        middleAdminId: v.middleAdminId,
        source: "brand",
        brandId: v.brandId,
        sellerId: null,
        orderAmount: Math.round(v.orderAmount),
        marginAmount: Math.round(v.marginAmount),
      });
    }

    // 경로 2) 셀러 마진 — 셀러에 중간관리자가 있고 요율 > 0 이면 1건
    const sellerMiddleAdminId = (seller as any).middleAdminId as string | null;
    const sellerMarginRate = Number((seller as any).middleAdminMarginRate ?? 0);
    if (sellerMiddleAdminId && sellerMarginRate > 0) {
      const sellerMargin = computeSellerMargin(totalAmount, sellerMarginRate);
      if (sellerMargin > 0) {
        middleAdminCommissions.push({
          middleAdminId: sellerMiddleAdminId,
          source: "seller",
          brandId: null,
          sellerId: seller.id,
          orderAmount: Math.round(totalAmount),
          marginAmount: sellerMargin,
        });
      }
    }
  } catch (e) {
    // 적립 산정 실패가 주문을 막아서는 안 됨 — 로깅 후 적립 없이 진행
    console.error("[orders] 중간관리자 마진 산정 실패:", e);
    middleAdminCommissions.length = 0;
  }

  // ─── 주문 생성 + 캠페인 카운터 + 커미션 + 장바구니 정리를 원자적으로 ───
  const runOrderTransaction = () => prisma.$transaction(async (tx) => {
    // 재고 선점 — 조건부 update 로 경합을 막는다.
    // 재고 1개짜리 상품을 두 구매자가 동시에 주문하면 나중 트랜잭션의 count 가 0 이 되어 롤백되고,
    // 주문·결제가 아예 만들어지지 않는다.
    // (결제를 끝내지 않고 이탈하면 /api/orders/[id]/abort 가, PG 가 실패를 통보하면
    //  결제 콜백이 voidPendingOrder 로 재고를 복원한다)
    await reserveStockInTx(tx, stockOps);

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: session.user!.id,
        sellerId,
        campaignId: campaignId || null,
        totalAmount,
        shippingFee,
        // discountAmount 는 표시용 총할인(추천인/픽 + 쿠폰 + 장바구니).
        // cartDiscountAmount 는 그중 셀러 부담분만 별도 기록 — 정산 차감(lib/settlement.ts)에 사용.
        discountAmount: totalDiscountAmount + cartDiscountAmount,
        discountType: anyCouponApplied
          ? (discountType ? `${discountType}+coupon` : "coupon")
          : discountType,
        cartDiscountAmount,
        finalAmount,
        shippingName,
        shippingPhone,
        shippingAddress,
        shippingMemo,
        snsAccounts: snsAccountsJson,
        sellerFeeRateSnap,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    if (campaignId) {
      await tx.groupBuyCampaign.update({
        where: { id: campaignId },
        data: {
          participantCount: { increment: 1 },
          currentQuantity: { increment: totalQty },
          totalRevenue: { increment: finalAmount },
        },
      });
    }

    if (commission) {
      await tx.referralCommission.create({
        data: {
          sellerId: commission.sellerId,
          orderId: created.id,
          buyerUserId: session.user!.id,
          orderAmount: totalAmount,
          commissionRate: commission.commRate,
          commissionAmount: commission.commAmount,
          source: "referral",
          status: "PENDING",
        },
      });
      await tx.sellerProfile.update({
        where: { id: commission.sellerId },
        data: { totalReferralEarnings: { increment: commission.commAmount } },
      });
    }

    // 중간관리자 마진 적립 (브랜드/셀러 경로별 별도 레코드)
    for (const mc of middleAdminCommissions) {
      await tx.middleAdminCommission.create({
        data: {
          middleAdminId: mc.middleAdminId,
          orderId: created.id,
          source: mc.source,
          brandId: mc.brandId,
          sellerId: mc.sellerId,
          orderAmount: mc.orderAmount,
          marginAmount: mc.marginAmount,
          status: "PENDING",
        },
      });
    }

    // 멘토 커미션 생성 (셀러에게 멘토가 있는 경우)
    if (mentorCommissionData) {
      await (tx as any).mentorCommission.create({
        data: {
          mentorId: mentorCommissionData.mentorId,
          menteeId: mentorCommissionData.menteeId,
          orderId: created.id,
          baseAmount: finalAmount,
          commissionRate: mentorCommissionData.commissionRate / 100, // 퍼센트 → 소수점
          commissionAmount: mentorCommissionData.commissionAmount,
          status: "PENDING",
        },
      });
    }

    // 쿠폰 사용 처리
    if (appliedCouponId) {
      if (existingUserCouponId) {
        // 이미 수령한 쿠폰 → usedAt 설정
        await tx.userCoupon.update({
          where: { id: existingUserCouponId },
          data: { usedAt: new Date() },
        });
      } else {
        // 미수령 쿠폰 → 수령 + 사용 동시 처리 (issuedCount 증가)
        await tx.userCoupon.create({
          data: {
            liveCouponId: appliedCouponId,
            userId: session.user!.id,
            claimedAt: new Date(),
            usedAt: new Date(),
          },
        });
        await tx.liveCoupon.update({
          where: { id: appliedCouponId },
          data: { issuedCount: { increment: 1 } },
        });
      }
    }

    // 게임 당첨 쿠폰 사용 확정
    if (appliedGameCouponRowId) {
      await tx.userGameCoupon.update({
        where: { id: appliedGameCouponRowId },
        data: { usedAt: new Date() },
      });
    }

    await tx.cartItem.deleteMany({
      where: { userId: session.user!.id, sellerId },
    });

    return created;
  });

  // 재고 검증과 선점 사이에 다른 구매자가 마지막 재고를 가져간 경우 트랜잭션이 롤백된다.
  let order: Awaited<ReturnType<typeof runOrderTransaction>>;
  try {
    order = await runOrderTransaction();
  } catch (e) {
    if (e instanceof StockShortageError) {
      return NextResponse.json(
        { error: "재고가 부족합니다. 다른 구매자가 방금 결제했을 수 있습니다." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({
    order: {
      ...order,
      totalAmount: Number(order.totalAmount),
      shippingFee: Number(order.shippingFee),
      discountAmount: Number(order.discountAmount),
      finalAmount: Number(order.finalAmount),
    },
  }, { status: 201 });
}
