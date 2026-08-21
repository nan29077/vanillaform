import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BulkMode,
  HEADER_TO_KEY,
  HEADER_MARKER,
  EXAMPLE_PREFIX,
  BADGE_CODES,
  BADGE_LABEL_TO_CODE,
  normalizeHeader,
} from "@/lib/bulkProductColumns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 한 번에 처리 가능한 최대 행 수 (과도한 요청 방지)
const MAX_ROWS = 1000;

// 금액 파싱 (콤마 허용, 음수/NaN은 기본값)
function toMoney(value: any, fallback = 0): number {
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return isNaN(n) || n < 0 ? fallback : n;
}
function toMoneyOrNull(value: any): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) || n < 0 ? null : n;
}

function roleToMode(role: string): BulkMode | null {
  switch (role) {
    case "SUPER_ADMIN":
      return "admin";
    case "BRAND_ADMIN":
      return "brand";
    case "MIDDLE_ADMIN":
      return "middle";
    case "SELLER":
      return "seller";
    default:
      return null;
  }
}

// 배지 입력값(라벨 또는 코드)을 코드로 정규화
function normalizeBadges(raw: string): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!t) continue;
    if (BADGE_LABEL_TO_CODE[t]) {
      if (!out.includes(BADGE_LABEL_TO_CODE[t])) out.push(BADGE_LABEL_TO_CODE[t]);
    } else if (BADGE_CODES.includes(t) && !out.includes(t)) {
      out.push(t);
    }
    // 알 수 없는 배지는 무시 (오류로 취급하지 않음)
  }
  return out;
}

// 옵션 문자열 → variant 배열 ("옵션명:판매가:재고" 세미콜론 구분)
function parseVariants(raw: string): { name: string; price: string; stock: string }[] {
  if (!raw) return [];
  const list: { name: string; price: string; stock: string }[] = [];
  for (const part of raw.split(";")) {
    const seg = part.split(":");
    const name = (seg[0] || "").trim();
    if (!name) continue;
    list.push({
      name,
      price: (seg[1] || "").trim(),
      stock: (seg[2] || "").trim(),
    });
  }
  return list;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const role = session.user.role;
    const mode = roleToMode(role);
    if (!mode) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 파일 수신 + 제공 방식(priceType)
    let file: File | null = null;
    let priceType: "SUPPLY_PRICE" | "COMMISSION" = "SUPPLY_PRICE";
    try {
      const fd = await req.formData();
      const f = fd.get("file");
      if (f instanceof File) file = f;
      // 셀러 직접 등록은 항상 공급가(판매가) 방식 → 수수료 방식은 카탈로그(브랜드/관리자/중간관리자)만
      if (fd.get("priceType") === "COMMISSION" && mode !== "seller") priceType = "COMMISSION";
    } catch {
      return NextResponse.json({ error: "파일 업로드 형식이 올바르지 않습니다" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "엑셀 파일을 첨부해주세요" }, { status: 400 });
    }

    // 엑셀 파싱
    let rows: any[][];
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        return NextResponse.json({ error: "엑셀에 시트가 없습니다" }, { status: 400 });
      }
      const ws = wb.Sheets[firstSheet];
      rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: true });
    } catch {
      return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다. 양식을 확인해주세요" }, { status: 400 });
    }

    // 제목(헤더) 행 찾기 — "상품명" 셀이 있는 행
    const markerNorm = normalizeHeader(HEADER_MARKER);
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i] || []).some((c) => normalizeHeader(String(c)) === markerNorm)) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) {
      return NextResponse.json(
        { error: "제목 행을 찾을 수 없습니다. 템플릿의 '상품명' 제목 행을 삭제하지 마세요" },
        { status: 400 }
      );
    }

    const headerRow = rows[headerIdx] || [];
    const colKeyByIndex: (string | undefined)[] = headerRow.map(
      (h) => HEADER_TO_KEY[normalizeHeader(String(h))]
    );

    const dataRows = rows.slice(headerIdx + 1);
    if (dataRows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_ROWS}개까지 등록할 수 있습니다` },
        { status: 400 }
      );
    }

    // 역할별 사전 데이터 로드
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const categoryByName = new Map<string, string>();
    for (const c of categories) categoryByName.set(c.name.trim(), c.id);

    // 브랜드 매핑 (관리자 전용) / 프로필 (브랜드·셀러·중간관리자)
    const brandByName = new Map<string, { id: string; middleAdminId: string | null }>();
    let brandProfileId: string | null = null;
    let brandProfileMiddleId: string | null = null;
    let sellerProfileId: string | null = null;
    let middleAdminId: string | null = null;

    if (mode === "admin") {
      const brands = await prisma.brandProfile.findMany({
        select: { id: true, brandName: true, middleAdminId: true },
      });
      for (const b of brands)
        brandByName.set(b.brandName.trim(), { id: b.id, middleAdminId: b.middleAdminId ?? null });
    } else if (mode === "brand") {
      const bp = await prisma.brandProfile.findUnique({ where: { userId: session.user!.id } });
      if (!bp) return NextResponse.json({ error: "브랜드 프로필이 없습니다" }, { status: 400 });
      brandProfileId = bp.id;
      brandProfileMiddleId = bp.middleAdminId ?? null;
    } else if (mode === "seller") {
      const sp = await prisma.sellerProfile.findUnique({ where: { userId: session.user!.id } });
      if (!sp) return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다" }, { status: 400 });
      sellerProfileId = sp.id;
    } else if (mode === "middle") {
      const midId = session.user.middleAdminId as string | undefined;
      if (!midId) return NextResponse.json({ error: "중간관리자 프로필이 없습니다" }, { status: 400 });
      middleAdminId = midId;
    }

    // 공개 정책 (단일 등록과 동일): 브랜드·중간관리자는 비공개, 관리자·셀러는 자동 공개
    const isApproved = mode !== "brand" && mode !== "middle";

    type RowResult = { row: number; name: string; ok: boolean; error?: string };
    const results: RowResult[] = [];
    let success = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const excelRow = headerIdx + 1 + i + 1; // 1-based 스프레드시트 행 번호
      const raw = dataRows[i] || [];

      // 레코드 구성
      const rec: Record<string, string> = {};
      for (let j = 0; j < colKeyByIndex.length; j++) {
        const key = colKeyByIndex[j];
        if (!key) continue;
        rec[key] = raw[j] !== undefined && raw[j] !== null ? String(raw[j]).trim() : "";
      }

      // 완전히 빈 행은 건너뜀
      const hasAny = Object.values(rec).some((v) => v !== "");
      if (!hasAny) continue;

      const name = rec.name || "";

      // 예시 행은 등록에서 제외 (오류 아님)
      if (name.startsWith(EXAMPLE_PREFIX)) continue;

      try {
        if (!name) throw new Error("상품명은 필수입니다");

        // 가격 결정 (단일 등록 폼과 동일한 의미)
        let parsedBasePrice: number;
        let supplyPrice: number | null = null;
        let commissionRate: number | null = null;
        let sellerCommissionAmount: number | null = null;
        if (mode === "seller") {
          const bp = toMoneyOrNull(rec.basePrice);
          if (bp === null) throw new Error("판매가는 필수이며 0 이상 숫자여야 합니다");
          parsedBasePrice = bp;
        } else if (priceType === "COMMISSION") {
          // 수수료 제공: 판매가(소비자가) + 셀러수수료율(%) → 수수료 금액 계산
          const bp = toMoneyOrNull(rec.basePrice);
          if (bp === null) throw new Error("판매가(소비자가)는 필수이며 0 이상 숫자여야 합니다");
          parsedBasePrice = bp;
          const cr = toMoneyOrNull(rec.sellerCommissionRate);
          if (cr === null) throw new Error("셀러수수료율(%)은 필수이며 0 이상 숫자여야 합니다");
          commissionRate = cr;
          sellerCommissionAmount = Math.round((bp * cr) / 100);
        } else {
          const sp = toMoneyOrNull(rec.supplyPrice);
          if (sp === null) throw new Error("공급가는 필수이며 0 이상 숫자여야 합니다");
          supplyPrice = sp;
          parsedBasePrice = sp; // 브랜드/관리자/중간관리자: 판매가는 셀러가 확정 → 공급가로 임시 저장
        }

        // 중간관리자 마진 (수수료 방식에서는 미사용)
        let resolvedMiddleAdminMargin: number | null = null;
        if (priceType !== "COMMISSION" && (mode === "admin" || mode === "middle")) {
          resolvedMiddleAdminMargin = toMoneyOrNull(rec.middleAdminMargin);
        }

        // 브랜드 / 중간관리자 귀속
        let actualBrandId: string | null = null;
        let productMiddleAdminId: string | null = null;
        if (mode === "brand") {
          actualBrandId = brandProfileId;
          productMiddleAdminId = brandProfileMiddleId;
        } else if (mode === "admin") {
          const bn = rec.brandName;
          if (bn) {
            const found = brandByName.get(bn);
            if (!found) throw new Error(`브랜드 '${bn}'를 찾을 수 없습니다`);
            actualBrandId = found.id;
            productMiddleAdminId = found.middleAdminId;
          }
        } else if (mode === "middle") {
          productMiddleAdminId = middleAdminId;
        }

        // 카테고리
        let categoryId: string | null = null;
        if (rec.categoryName) {
          const cid = categoryByName.get(rec.categoryName);
          if (!cid) throw new Error(`카테고리 '${rec.categoryName}'를 찾을 수 없습니다`);
          categoryId = cid;
        }

        // 이미지
        const images = (rec.images || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const thumbnail = rec.thumbnail || images[0] || null;

        // 옵션 → variants
        const variants = parseVariants(rec.options);
        const totalStock =
          variants.length > 0
            ? variants.reduce((acc, v) => acc + (parseInt(v.stock || "0") || 0), 0)
            : Math.max(0, parseInt(rec.stock || "0") || 0);

        // 배지
        const badges = normalizeBadges(rec.badges);

        // 배송
        const freeShipping = /^(y|yes|true|1|무료|o|예)$/i.test((rec.freeShipping || "").trim());

        // slug (행 인덱스 포함으로 동일명 충돌 방지)
        const slug =
          name.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-").replace(/-+/g, "-") +
          "-" +
          Date.now().toString(36) +
          "-" +
          i;

        const product = await prisma.product.create({
          data: {
            name,
            slug,
            description: rec.description || null,
            detailContent: rec.detailContent || null,
            basePrice: parsedBasePrice,
            comparePrice: toMoneyOrNull(rec.comparePrice),
            supplyPrice: mode === "seller" || priceType === "COMMISSION" ? null : supplyPrice,
            middleAdminMargin: resolvedMiddleAdminMargin,
            priceModel: priceType === "COMMISSION" ? "COMMISSION" : "SUPPLY",
            commissionRate,
            sellerCommissionAmount,
            totalStock,
            categoryId,
            brandId: actualBrandId,
            middleAdminId: productMiddleAdminId,
            sellerId: mode === "seller" ? sellerProfileId : null,
            thumbnail,
            isActive: true,
            isApproved,
            allowGroupBuy: false,
            badges: badges.length > 0 ? JSON.stringify(badges) : null,
            shippingFee: freeShipping ? 0 : toMoney(rec.shippingFee, 0),
            freeShipping,
            freeShippingThreshold: !freeShipping ? toMoneyOrNull(rec.freeShippingThreshold) : null,
            remoteAreaFee: toMoney(rec.remoteAreaFee, 0),
            ...(variants.length > 0
              ? {
                  variants: {
                    create: variants.map((v, idx) => ({
                      name: v.name,
                      price: v.price ? parseFloat(v.price.replace(/,/g, "")) || parsedBasePrice : parsedBasePrice,
                      stock: parseInt(v.stock || "0") || 0,
                      sortOrder: idx,
                    })),
                  },
                }
              : {}),
            ...(images.length > 0
              ? {
                  images: {
                    create: images.map((url, idx) => ({
                      url,
                      alt: `${name} 이미지 ${idx + 1}`,
                      sortOrder: idx,
                    })),
                  },
                }
              : {}),
          },
        });

        // 셀러 직접 등록: 본인 샵에 즉시 판매 상태로 추가
        if (mode === "seller" && sellerProfileId) {
          await prisma.sellerShopProduct.upsert({
            where: { sellerId_productId: { sellerId: sellerProfileId, productId: product.id } },
            update: {},
            create: {
              sellerId: sellerProfileId,
              productId: product.id,
              isActive: true,
              isApproved: true,
            },
          });
        }

        success++;
        results.push({ row: excelRow, name, ok: true });
      } catch (e: any) {
        results.push({ row: excelRow, name: name || "(이름없음)", ok: false, error: e?.message || "등록 실패" });
      }
    }

    const failed = results.filter((r) => !r.ok).length;
    if (results.length === 0) {
      return NextResponse.json(
        { error: "등록할 상품 데이터가 없습니다. 제목 행 아래에 상품을 입력했는지 확인해주세요" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      total: results.length,
      successCount: success,
      failedCount: failed,
      results,
    });
  } catch (e: any) {
    console.error("[products/bulk-register] 대량 등록 실패:", {
      code: e?.code,
      message: e?.message,
      meta: e?.meta,
    });
    return NextResponse.json(
      { error: "대량 등록 처리 실패", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
