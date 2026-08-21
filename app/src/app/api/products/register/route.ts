import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 금액(배송비 등) 파싱: 음수/NaN은 기본값으로 보정
function toMoney(value: any, fallback = 0): number {
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? fallback : n;
}
// 임계금액: 비어있으면 null(무료배송 임계 미설정), 값이 있으면 음수 보정
function toMoneyOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? null : n;
}

// GET: Get categories for product registration form, or admin product list
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "BRAND_ADMIN" && role !== "SELLER" && role !== "MIDDLE_ADMIN") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    // Admin/Brand product management mode - return all products with flags
    if (mode === "admin-manage") {
      if (role !== "SUPER_ADMIN" && role !== "BRAND_ADMIN") {
        return NextResponse.json({ error: "권한 없음" }, { status: 403 });
      }

      const where: any = { isActive: true };
      if (role === "BRAND_ADMIN") {
        const brand = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
        if (brand) where.brandId = brand.id;
      }

      const products = await prisma.product.findMany({
        where,
        include: {
          brand: { select: { brandName: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      // 판매가 비노출: 브랜드 역할에는 판매가(basePrice)를 내려보내지 않고 공급가만 제공
      const isBrandList = role === "BRAND_ADMIN";

      return NextResponse.json({
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          thumbnail: p.thumbnail,
          basePrice: isBrandList ? null : Number(p.basePrice),
          supplyPrice: p.supplyPrice != null ? Number(p.supplyPrice) : null,
          brandName: p.brand?.brandName || null,
          categoryName: p.category?.name || null,
          allowGroupBuy: p.allowGroupBuy,
          allowLiveCommerce: (p as any).allowLiveCommerce ?? false,
        })),
      });
    }

    // Default: return categories
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST: Register a new product (Admin/Brand/Seller) — optionally with group-buy campaign
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "BRAND_ADMIN" && role !== "SELLER" && role !== "MIDDLE_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, description, basePrice, comparePrice, categoryId,
      brandId, thumbnail, detailContent, variants, images,
      isGroupBuy, groupBuy, badges,
      shippingFee, freeShipping, freeShippingThreshold, remoteAreaFee,
      supplyPrice, middleAdminMargin, stock,
      priceModel, sellerCommissionRate,
      optionGroups, coupangLowestPrice, naverLowestPrice,
    } = body;

    if (!name || basePrice === undefined || basePrice === null || basePrice === "") {
      return NextResponse.json({ error: "상품명과 가격은 필수입니다" }, { status: 400 });
    }

    const parsedBasePrice = parseFloat(String(basePrice));
    if (isNaN(parsedBasePrice) || parsedBasePrice < 0) {
      return NextResponse.json({ error: "유효한 가격을 입력해주세요" }, { status: 400 });
    }

    // 가격 역전 방지 — 정가(comparePrice)는 판매가 위에 취소선으로 붙는 비교가이므로
    // 판매가보다 낮으면 구매자 화면에 "할인인데 더 비싼" 표시가 된다.
    if (comparePrice !== undefined && comparePrice !== null && comparePrice !== "") {
      const parsedComparePrice = parseFloat(String(comparePrice));
      if (isNaN(parsedComparePrice) || parsedComparePrice < 0) {
        return NextResponse.json({ error: "유효한 정가를 입력해주세요" }, { status: 400 });
      }
      if (parsedComparePrice < parsedBasePrice) {
        return NextResponse.json(
          { error: "정가는 판매가보다 낮을 수 없습니다" },
          { status: 400 }
        );
      }
    }

    // Validate group buy fields
    if (isGroupBuy && groupBuy) {
      if (!groupBuy.campaignPrice || !groupBuy.startDate || !groupBuy.endDate) {
        return NextResponse.json(
          { error: "공동구매 등록 시 가격, 시작일, 종료일은 필수입니다" },
          { status: 400 }
        );
      }
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-") + "-" + Date.now().toString(36);

    // Resolve brand ID
    let actualBrandId = brandId || null;
    if (role === "BRAND_ADMIN" && !brandId) {
      const brandProfile = await prisma.brandProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!brandProfile) {
        return NextResponse.json({ error: "브랜드 프로필이 없습니다" }, { status: 400 });
      }
      actualBrandId = brandProfile.id;
    }

    // 공급가 / 중간관리자 마진 (브랜드/관리자 전용, 셀러는 미지원)
    // 정책 자동계산은 폐지 — 마진은 중간관리자가 상품관리에서 직접 입력한다.
    // 브랜드 등록 시에는 마진을 입력하지 않으며(null), 관리자만 등록 시 직접 입력 가능.
    const parsedSupplyPrice = toMoneyOrNull(supplyPrice);
    let resolvedMiddleAdminMargin: number | null = null;
    if (role === "SUPER_ADMIN" || role === "MIDDLE_ADMIN") {
      resolvedMiddleAdminMargin = toMoneyOrNull(middleAdminMargin);
    }

    // 제공 방식: SUPPLY(공급가 제공) / COMMISSION(수수료 제공). 셀러 직접 등록은 항상 SUPPLY.
    const resolvedPriceModel: "SUPPLY" | "COMMISSION" =
      role !== "SELLER" && priceModel === "COMMISSION" ? "COMMISSION" : "SUPPLY";
    // 수수료 제공 시: 셀러 수수료율(%)과 수수료 금액(판매가 × 수수료율)을 저장
    let resolvedCommissionRate: number | null = null;
    let resolvedSellerCommissionAmount: number | null = null;
    if (resolvedPriceModel === "COMMISSION") {
      resolvedCommissionRate = toMoneyOrNull(sellerCommissionRate);
      if (resolvedCommissionRate != null) {
        resolvedSellerCommissionAmount = Math.round(parsedBasePrice * resolvedCommissionRate / 100);
      }
    }

    // 정산 귀속: 브랜드가 중간관리자 소속이면 상품도 해당 중간관리자에 귀속시킨다.
    let productMiddleAdminId: string | null = null;
    if (actualBrandId) {
      const brandForMid = await prisma.brandProfile.findUnique({
        where: { id: actualBrandId },
        select: { middleAdminId: true },
      });
      productMiddleAdminId = brandForMid?.middleAdminId ?? null;
    }
    // 중간관리자가 직접 등록한 상품(브랜드 없음)은 본인 중간관리자 프로필에 귀속시킨다.
    if (role === "MIDDLE_ADMIN") {
      const midId = session.user.middleAdminId as string | undefined;
      if (!midId) {
        return NextResponse.json({ error: "중간관리자 프로필이 없습니다" }, { status: 400 });
      }
      productMiddleAdminId = midId;
    }

    // For sellers, get their seller profile
    let sellerProfile = null;
    if (role === "SELLER") {
      sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!sellerProfile) {
        return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다" }, { status: 400 });
      }
    }

    // 재고: 옵션(variant)이 있으면 옵션 재고 합계, 없으면 단일 상품 재고
    const variantList = Array.isArray(variants) ? variants.filter((v: any) => v.name) : [];
    const totalStock = variantList.length > 0
      ? variantList.reduce((acc: number, v: any) => acc + (parseInt(String(v.stock || "0")) || 0), 0)
      : Math.max(0, parseInt(String(stock ?? "0")) || 0);

    // 공개(셀러 노출) 정책:
    // - 브랜드 등록 상품: 비공개(isApproved=false) → 중간관리자가 판매가·마진 설정 후 공개 결정
    // - 중간관리자 등록 상품: 비공개(isApproved=false) → 최고관리자 승인 후 셀러에게 노출
    // - 관리자/셀러 등록 상품: 자동 공개
    const isApproved = role !== "BRAND_ADMIN" && role !== "MIDDLE_ADMIN";

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || null,
        detailContent: detailContent || null,
        basePrice: parsedBasePrice,
        comparePrice: comparePrice ? parseFloat(String(comparePrice)) : null,
        supplyPrice: resolvedPriceModel === "COMMISSION" ? null : parsedSupplyPrice,
        middleAdminMargin: resolvedPriceModel === "COMMISSION" ? null : resolvedMiddleAdminMargin,
        // 제공 방식 (공급가 제공 / 수수료 제공)
        priceModel: resolvedPriceModel,
        commissionRate: resolvedCommissionRate,
        sellerCommissionAmount: resolvedSellerCommissionAmount,
        totalStock,
        categoryId: categoryId || null,
        brandId: actualBrandId,
        // 브랜드가 중간관리자 소속이면 상품 정산도 해당 중간관리자에 귀속
        middleAdminId: productMiddleAdminId,
        // 셀러 직접 등록 상품은 등록 셀러를 기록 → 다른 셀러의 '상품 신청' 목록에서 제외됨
        sellerId: role === "SELLER" && sellerProfile ? sellerProfile.id : null,
        thumbnail: thumbnail || (images && images.length > 0 ? images[0] : null),
        isActive: true,
        isApproved,
        allowGroupBuy: isGroupBuy ? true : false,
        badges: badges && Array.isArray(badges) && badges.length > 0 ? JSON.stringify(badges) : null,
        ...((optionGroups && Array.isArray(optionGroups) && optionGroups.length > 0)
          ? { optionGroups: JSON.stringify(optionGroups) } as any
          : {}),
        shippingFee: toMoney(shippingFee, 0),
        freeShipping: !!freeShipping,
        freeShippingThreshold: toMoneyOrNull(freeShippingThreshold),
        remoteAreaFee: toMoney(remoteAreaFee, 0),
        // 외부 최저가 (브랜드·관리자만 입력, 셀러는 null)
        coupangLowestPrice: role !== "SELLER" ? toMoneyOrNull(coupangLowestPrice) : null,
        naverLowestPrice: role !== "SELLER" ? toMoneyOrNull(naverLowestPrice) : null,
        ...(variants && Array.isArray(variants) && variants.length > 0 ? {
          variants: {
            create: variants.filter((v: any) => v.name).map((v: any, i: number) => ({
              name: v.name,
              price: parseFloat(String(v.price || basePrice)),
              stock: parseInt(String(v.stock || "0")),
              sortOrder: i,
            })),
          },
        } : {}),
        ...(images && Array.isArray(images) && images.length > 0 ? {
          images: {
            create: images.filter(Boolean).map((url: string, i: number) => ({
              url,
              alt: `${name} 이미지 ${i + 1}`,
              sortOrder: i,
            })),
          },
        } : {}),
      },
    });

    // If seller, also add to their shop products (active + 승인완료 → 즉시 판매중)
    // 이미 샵상품이 있으면 그대로 두고, 없으면 승인완료 상태로 생성(관리자 승인 불필요)
    if (role === "SELLER" && sellerProfile) {
      await prisma.sellerShopProduct.upsert({
        where: {
          sellerId_productId: { sellerId: sellerProfile.id, productId: product.id },
        },
        update: {},
        create: {
          sellerId: sellerProfile.id,
          productId: product.id,
          isActive: true,
          isApproved: true, // 셀러 직접 등록 상품은 승인 대기 없이 즉시 판매
        },
      });
    }

    // Create group-buy campaign if requested
    let campaign = null;
    if (isGroupBuy && groupBuy && sellerProfile) {
      campaign = await prisma.groupBuyCampaign.create({
        data: {
          productId: product.id,
          sellerId: sellerProfile.id,
          title: groupBuy.title || product.name,
          campaignPrice: parseFloat(String(groupBuy.campaignPrice)),
          originalPrice: parsedBasePrice,
          goalQuantity: groupBuy.goalQuantity ? parseInt(String(groupBuy.goalQuantity)) : null,
          minOrderQuantity: parseInt(String(groupBuy.minOrderQuantity || "1")) || 1,
          maxOrderQuantity: groupBuy.maxOrderQuantity ? parseInt(String(groupBuy.maxOrderQuantity)) : null,
          limitPerPerson: parseInt(String(groupBuy.limitPerPerson || "10")) || 10,
          startDate: new Date(groupBuy.startDate),
          endDate: new Date(groupBuy.endDate),
          description: groupBuy.description || null,
          bannerImage: groupBuy.bannerImage || null,
          estimatedDelivery: groupBuy.estimatedDelivery ? new Date(groupBuy.estimatedDelivery) : null,
          status: "SCHEDULED",
        },
      });
    }

    return NextResponse.json({ success: true, product, campaign });
  } catch (e: any) {
    // 원인 파악을 위한 상세 로깅 (Prisma 코드/메시지 포함)
    console.error("[products/register] 상품 등록 실패:", {
      code: e?.code,
      message: e?.message,
      meta: e?.meta,
    });
    return NextResponse.json(
      { error: "상품 등록 실패", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
