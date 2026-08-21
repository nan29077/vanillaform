import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatProductNameForSeller } from "@/lib/productName";

// 금액(배송비 등) 파싱: 음수/NaN은 기본값으로 보정
function toMoney(value: any, fallback = 0): number {
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? fallback : n;
}
// 임계금액: 비어있으면 null, 값이 있으면 음수 보정
function toMoneyOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(String(value));
  return isNaN(n) || n < 0 ? null : n;
}

// GET: Fetch product data for editing
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER", "MIDDLE_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        brand: true,
        variants: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        sellerProducts: {
          include: {
            seller: {
              select: { id: true, shopName: true, shopLogo: true, slug: true },
            },
          },
        },
        _count: {
          select: { reviews: true, campaigns: true, sellerProducts: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    // Check brand ownership
    if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!brand || product.brandId !== brand.id) {
        return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
      }
    }

    // Fetch categories for the form
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, slug: true, parentId: true },
    });

    // 판매가 비노출: 브랜드 역할에는 판매가(basePrice)·정가(comparePrice)·중간관리자 마진을 응답에서 제거.
    // 브랜드는 공급가(supplyPrice)만 조회/수정한다.
    const isBrand = role === "BRAND_ADMIN";
    // 셀러 역할: 상품명 포맷 변환
    // - 중간관리자 상품: "(브랜드명 + 중간관리자이름)" → "(중간관리자이름)"
    // - 브랜드 직접 등록 상품: "(브랜드명 + ...)" → "(브랜드명)" / 그대로 유지
    const isSeller = role === "SELLER";

    // 셀러 노출 공급가 = 공급가 + 중간관리자 마진 + 관리자 마진 (공급가 없으면 판매가로 폴백)
    // 셀러에게는 원본 공급가·마진 내역을 숨기고 합계만 공급가로 보여준다.
    const sellerSupply =
      (product.supplyPrice != null ? Number(product.supplyPrice) : Number(product.basePrice)) +
      (product.middleAdminMargin != null ? Number(product.middleAdminMargin) : 0) +
      (product.adminMargin != null ? Number(product.adminMargin) : 0);

    return NextResponse.json({
      product: {
        ...product,
        name: isSeller ? formatProductNameForSeller(product.name, product.middleAdminId) : product.name,
        basePrice: isBrand ? null : Number(product.basePrice),
        comparePrice: isBrand ? null : (product.comparePrice ? Number(product.comparePrice) : null),
        supplyPrice: isSeller
          ? sellerSupply
          : product.supplyPrice != null ? Number(product.supplyPrice) : null,
        middleAdminMargin: isBrand || isSeller ? null : (product.middleAdminMargin != null ? Number(product.middleAdminMargin) : null),
        adminMargin: isSeller ? 0 : product.adminMargin,
        shippingFee: Number(product.shippingFee),
        freeShippingThreshold: product.freeShippingThreshold ? Number(product.freeShippingThreshold) : null,
        remoteAreaFee: Number(product.remoteAreaFee),
        coupangLowestPrice: product.coupangLowestPrice != null ? Number(product.coupangLowestPrice) : null,
        naverLowestPrice: product.naverLowestPrice != null ? Number(product.naverLowestPrice) : null,
        variants: product.variants.map((v) => ({
          ...v,
          price: Number(v.price),
        })),
      },
      categories,
    });
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT: Update product
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const role = session.user.role;
    if (!["SUPER_ADMIN", "BRAND_ADMIN", "SELLER"].includes(role)) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    });
    if (!product) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
    }

    // Check brand ownership
    if (role === "BRAND_ADMIN") {
      const brand = await prisma.brandProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!brand || product.brandId !== brand.id) {
        return NextResponse.json({ error: "이 상품에 대한 권한이 없습니다" }, { status: 403 });
      }
    }

    // Check seller ownership — 셀러는 본인이 직접 등록한 상품만 수정 가능
    if (role === "SELLER") {
      const sellerProfile = await prisma.sellerProfile.findUnique({
        where: { userId: session.user!.id },
      });
      if (!sellerProfile || product.sellerId !== sellerProfile.id) {
        return NextResponse.json({ error: "본인이 등록한 상품만 수정할 수 있습니다" }, { status: 403 });
      }
    }

    const body = await req.json();
    const {
      name, description, basePrice, comparePrice, supplyPrice, categoryId,
      thumbnail, detailContent, variants, images, badges, isActive,
      shippingFee, freeShipping, freeShippingThreshold, remoteAreaFee, stock,
      optionGroups, coupangLowestPrice, naverLowestPrice,
    } = body;

    // 판매가 비노출: 브랜드는 판매가(basePrice)·정가를 입력/수정할 수 없다.
    // 브랜드 요청에 basePrice가 와도 무시하고 기존 판매가를 보존한다.
    const isBrand = role === "BRAND_ADMIN";

    if (!name) {
      return NextResponse.json({ error: "상품명은 필수입니다" }, { status: 400 });
    }

    // 판매가 검증·수정은 관리자(SUPER_ADMIN)만. 브랜드는 공급가만 수정.
    let parsedBasePrice: number | undefined;
    if (!isBrand) {
      if (basePrice === undefined || basePrice === null || basePrice === "") {
        return NextResponse.json({ error: "상품명과 가격은 필수입니다" }, { status: 400 });
      }
      parsedBasePrice = parseFloat(String(basePrice));
      if (isNaN(parsedBasePrice) || parsedBasePrice < 0) {
        return NextResponse.json({ error: "유효한 가격을 입력해주세요" }, { status: 400 });
      }
    }

    // 재고: 옵션이 있으면 옵션 재고 합계, 없으면 단일 상품 재고(stock). 둘 다 미지정이면 기존값 유지
    const variantList = Array.isArray(variants) ? variants.filter((v: any) => v.name) : null;
    let totalStockUpdate: number | undefined;
    if (variantList && variantList.length > 0) {
      totalStockUpdate = variantList.reduce((acc: number, v: any) => acc + (parseInt(String(v.stock || "0")) || 0), 0);
    } else if (stock !== undefined) {
      totalStockUpdate = Math.max(0, parseInt(String(stock), 10) || 0);
    }

    // 상품 기본 정보 업데이트
    const updateData: any = {
      name,
      description: description || null,
      detailContent: detailContent || null,
      categoryId: categoryId || null,
      thumbnail: thumbnail || null,
      isActive: isActive !== undefined ? !!isActive : undefined,
      shippingFee: shippingFee !== undefined ? toMoney(shippingFee, 0) : undefined,
      freeShipping: freeShipping !== undefined ? !!freeShipping : undefined,
      freeShippingThreshold: freeShippingThreshold !== undefined ? toMoneyOrNull(freeShippingThreshold) : undefined,
      remoteAreaFee: remoteAreaFee !== undefined ? toMoney(remoteAreaFee, 0) : undefined,
      ...(totalStockUpdate !== undefined ? { totalStock: totalStockUpdate } : {}),
    };

    // 브랜드는 판매가 수정 불가, 공급가만 수정
    if (!isBrand && parsedBasePrice !== undefined) {
      updateData.basePrice = parsedBasePrice;
      if (comparePrice !== undefined) {
        const parsedComparePrice = comparePrice ? parseFloat(String(comparePrice)) : null;
        // 가격 역전 방지 — 정가는 판매가 위에 취소선으로 붙는 비교가라 더 낮을 수 없다.
        if (parsedComparePrice != null && parsedComparePrice < parsedBasePrice) {
          return NextResponse.json(
            { error: "정가는 판매가보다 낮을 수 없습니다" },
            { status: 400 }
          );
        }
        updateData.comparePrice = parsedComparePrice;
      }
    }
    // 셀러 응답의 supplyPrice는 마진이 합산된 노출용 값이므로, 셀러 요청의 공급가는 저장하지 않는다.
    if (supplyPrice !== undefined && role !== "SELLER") {
      updateData.supplyPrice = toMoneyOrNull(supplyPrice);
      // 브랜드가 공급가만 수정하는 경우: 중간관리자가 아직 가격을 설정하지 않은 상품
      // (마진 미설정 + 판매가가 등록 시 복사된 기존 공급가 그대로)은 복사된 판매가도
      // 새 공급가로 함께 갱신한다 — 판매가<공급가 역전이 생기는 것을 방지.
      if (
        isBrand &&
        updateData.supplyPrice != null &&
        product.middleAdminMargin == null &&
        product.supplyPrice != null &&
        Number(product.basePrice) === Number(product.supplyPrice)
      ) {
        updateData.basePrice = updateData.supplyPrice;
      }
    }
    if (badges !== undefined) {
      updateData.badges = badges && Array.isArray(badges) && badges.length > 0 ? JSON.stringify(badges) : null;
    }
    if (optionGroups !== undefined) {
      updateData.optionGroups = optionGroups && Array.isArray(optionGroups) && optionGroups.length > 0
        ? JSON.stringify(optionGroups)
        : null;
    }
    // 외부 최저가: 브랜드·관리자만 수정 가능 (셀러는 무시)
    if (role !== "SELLER") {
      if (coupangLowestPrice !== undefined) {
        updateData.coupangLowestPrice = toMoneyOrNull(coupangLowestPrice);
      }
      if (naverLowestPrice !== undefined) {
        updateData.naverLowestPrice = toMoneyOrNull(naverLowestPrice);
      }
    }

    // undefined 값 제거 (기존값 유지)
    Object.keys(updateData).forEach(k => { if (updateData[k] === undefined) delete updateData[k]; });

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    });

    // variants 업데이트: 기존 삭제 후 재생성
    if (variantList !== null) {
      await prisma.productVariant.deleteMany({ where: { productId: params.id } });
      if (variantList.length > 0) {
        await prisma.productVariant.createMany({
          data: variantList.map((v: any, i: number) => ({
            productId: params.id,
            name: v.name,
            price: parseFloat(String(v.price || updated.basePrice)),
            stock: parseInt(String(v.stock || "0")) || 0,
            sortOrder: i,
            isActive: true,
          })),
        });
      }
    }

    // images 업데이트: 제공된 경우 재생성
    if (images && Array.isArray(images)) {
      await prisma.productImage.deleteMany({ where: { productId: params.id } });
      if (images.filter(Boolean).length > 0) {
        await prisma.productImage.createMany({
          data: images.filter(Boolean).map((url: string, i: number) => ({
            productId: params.id,
            url,
            alt: `${name} 이미지 ${i + 1}`,
            sortOrder: i,
          })),
        });
      }
    }

    return NextResponse.json({ success: true, product: { ...updated, basePrice: Number(updated.basePrice) } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
  const role = session.user.role;
  if (role !== "BRAND_ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
