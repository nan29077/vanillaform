import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  HEADER_TO_KEY,
  HEADER_MARKER,
  EXAMPLE_PREFIX,
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

// 셀러 일반상품(빠른상품, DirectProduct) 엑셀 대량 등록
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user?.role !== "SELLER") {
      return NextResponse.json({ error: "라이브 셀러만 이용할 수 있습니다" }, { status: 403 });
    }

    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: session.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json({ error: "라이브 셀러 프로필이 없습니다" }, { status: 400 });
    }

    // 파일 수신
    let file: File | null = null;
    try {
      const fd = await req.formData();
      const f = fd.get("file");
      if (f instanceof File) file = f;
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

        // 판매가 (일반상품 양식에서는 '판매가(원)' → basePrice 키로 매핑됨)
        const price = toMoneyOrNull(rec.basePrice);
        if (price === null) throw new Error("판매가는 필수이며 0 이상 숫자여야 합니다");

        // 이미지 (쉼표 구분, 첫 장이 대표 이미지)
        const images = (rec.images || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const stock = Math.max(0, parseInt(rec.stock || "0") || 0);
        const shippingFee = toMoney(rec.shippingFee, 0);

        await prisma.directProduct.create({
          data: {
            sellerId: seller.id,
            name,
            price,
            shippingFee,
            description: rec.description || null,
            images: images.length > 0 ? JSON.stringify(images) : null,
            stock,
            isActive: true,
          },
        });

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
    console.error("[seller/direct-products/bulk-register] 대량 등록 실패:", {
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
