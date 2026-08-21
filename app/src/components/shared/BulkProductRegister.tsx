"use client";

import { useState } from "react";
import { X, Upload, Download, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, Table2, Package, Percent } from "lucide-react";
import { useAppDialog } from "@/components/shared/AppDialog";
import {
  BulkMode,
  PriceType,
  columnsForMode,
  DIRECT_COLUMNS,
  BADGE_LABEL_TO_CODE,
} from "@/lib/bulkProductColumns";

interface BrandRef {
  id: string;
  brandName: string;
}
interface Props {
  mode: BulkMode;
  brands?: BrandRef[];
  // "catalog"(기본): 일반 상품 카탈로그 대량 등록(/api/products/bulk-register)
  // "direct": 셀러 일반상품(빠른상품) 대량 등록(/api/seller/direct-products/bulk-register)
  kind?: "catalog" | "direct";
  // 업로드 성공 후 목록 갱신 콜백. 없으면 페이지 새로고침으로 대체.
  onSuccess?: () => void;
}
interface RowResult {
  row: number;
  name: string;
  ok: boolean;
  error?: string;
}
interface UploadResult {
  total: number;
  successCount: number;
  failedCount: number;
  results: RowResult[];
}

const MODE_LABEL: Record<BulkMode, string> = {
  admin: "관리자",
  brand: "브랜드",
  seller: "라이브 셀러",
  middle: "중간관리자",
};

// 셀 스타일 헬퍼 (XLSX 인스턴스를 주입받아 사용 — SheetJS는 동적 로드)
function setStyle(XLSX: any, ws: any, r: number, c: number, style: any) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "s", v: "" };
  ws[addr].s = style;
}

export default function BulkProductRegister({ mode, brands = [], kind = "catalog", onSuccess }: Props) {
  const { appAlert } = useAppDialog();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  // 유형(제공 방식) 선택 팝업 상태
  const [typeOpen, setTypeOpen] = useState(false);
  const [priceType, setPriceType] = useState<PriceType>("SUPPLY_PRICE");

  const isDirect = kind === "direct";
  // 셀러 직접(일반)상품은 항상 판매가(공급가) 방식 → 유형 선택 불필요
  const showTypeStep = !isDirect && mode !== "seller";
  const isCommission = showTypeStep && priceType === "COMMISSION";
  const columns = isDirect ? DIRECT_COLUMNS : columnsForMode(mode, isCommission ? "COMMISSION" : "SUPPLY_PRICE");
  const badgeLabels = Object.keys(BADGE_LABEL_TO_CODE).join("/");
  // 대량 등록 API 엔드포인트 / 파일명 라벨
  const uploadUrl = isDirect
    ? "/api/seller/direct-products/bulk-register"
    : "/api/products/bulk-register";
  const fileLabel = isDirect ? "일반상품" : MODE_LABEL[mode];

  // ── 엑셀 템플릿 생성 & 다운로드 ──
  const downloadTemplate = async () => {
    // SheetJS는 용량이 크므로 클릭 시점에 동적 로드 (초기 번들에서 제외)
    const XLSXmod: any = await import("xlsx-js-style");
    const XLSX: any = XLSXmod.default ?? XLSXmod;

    // 참고용 카테고리 목록 조회 (카탈로그 모드만 필요, 실패해도 템플릿 생성은 진행)
    let categoryNames: string[] = [];
    if (!isDirect) {
      try {
        const res = await fetch("/api/products/register");
        if (res.ok) {
          const d = await res.json();
          categoryNames = (d.categories || []).map((c: any) => c.name);
        }
      } catch {
        /* noop */
      }
    }

    const nCols = columns.length;
    const lastCol = nCols - 1;

    // 상단 안내(병합) 문구 — 카탈로그/일반상품 각각에 맞게 구성 (모두 4행)
    const notices = isDirect
      ? [
          `📋 바닐라폼 일반상품(빠른상품) 대량 등록 양식`,
          `⚠️ 노란색 안내 행은 모두 삭제하고, 파란색 '상품명' 제목 행 아래에 상품 정보만 입력하세요.  (예시)로 시작하는 행은 등록되지 않습니다.`,
          `🖼 이미지는 URL로 입력합니다.  · 여러 장은 쉼표(,)로 구분하며 첫 번째 이미지가 대표 이미지로 사용됩니다.  · imgur 등 이미지 호스팅의 직접 URL(.jpg/.png)을 사용하세요.`,
          `💡 배송비 칸을 비우거나 0으로 두면 무료배송으로 표시됩니다.  · 재고 칸을 비우면 0으로 등록됩니다.`,
        ]
      : isCommission
      ? [
          `📋 바닐라폼 상품 대량 등록 양식 (수수료 제공 방식)  ·  대상 계정: ${MODE_LABEL[mode]}`,
          `⚠️ 노란색 안내 행은 모두 삭제하고, 파란색 '상품명' 제목 행 아래에 상품 정보만 입력하세요.  (예시)로 시작하는 행은 등록되지 않습니다.`,
          `💰 이 양식은 '수수료 제공' 방식입니다.  · 판매가(소비자가)와 셀러수수료율(%)을 입력하면 셀러 수수료 금액이 자동 계산됩니다.  · 공급가 방식이 필요하면 대량등록 시 '공급가로 제공'을 선택하세요.`,
          `🖼 이미지는 URL로 입력합니다.  · 여러 이미지 URL은 쉼표(,)로 구분합니다.  · 옵션은 '옵션명:판매가:재고' 형식이며 여러 개는 세미콜론(;)으로 구분합니다.  · 배지는 [${badgeLabels}] 중 쉼표로 구분해 입력합니다.  · 무료배송 칸은 Y 또는 N.`,
        ]
      : [
          `📋 바닐라폼 상품 대량 등록 양식 (공급가 제공 방식)  ·  대상 계정: ${MODE_LABEL[mode]}`,
          `⚠️ 노란색 안내 행은 모두 삭제하고, 파란색 '상품명' 제목 행 아래에 상품 정보만 입력하세요.  (예시)로 시작하는 행은 등록되지 않습니다.`,
          `🖼 이미지는 URL로 입력합니다.  · 구글 드라이브: 파일 우클릭→공유→'링크가 있는 모든 사용자'로 변경 후, 링크의 파일ID를 이용해  https://drive.google.com/uc?export=view&id=파일ID  형식으로 변환하세요.  · 또는 imgur 등 이미지 호스팅에 업로드 후 '이미지 주소 복사'로 얻은 직접 URL(.jpg/.png)을 사용하세요.`,
          `📝 여러 이미지 URL은 쉼표(,)로 구분합니다.  · 옵션은 '옵션명:판매가:재고' 형식이며 여러 개는 세미콜론(;)으로 구분합니다.  · 배지는 [${badgeLabels}] 중 쉼표로 구분해 입력합니다.  · 무료배송 칸은 Y 또는 N.`,
        ];

    // AOA 구성
    const aoa: any[][] = [];
    for (const n of notices) {
      const row = new Array(nCols).fill("");
      row[0] = n;
      aoa.push(row);
    }
    const guideRowIdx = aoa.length;
    aoa.push(columns.map((c) => (c.required ? `[필수] ${c.guide}` : c.guide)));
    const exampleRowIdx = aoa.length;
    aoa.push(columns.map((c) => c.example));
    const headerRowIdx = aoa.length;
    aoa.push(columns.map((c) => c.header));
    // 입력 편의를 위한 빈 행 몇 개
    for (let i = 0; i < 3; i++) aoa.push(new Array(nCols).fill(""));

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 열 너비
    ws["!cols"] = columns.map((c) => ({
      wch: Math.min(40, Math.max(14, c.header.length + 4, c.example.length + 2)),
    }));

    // 병합 (상단 안내 행)
    ws["!merges"] = notices.map((_, i) => ({
      s: { r: i, c: 0 },
      e: { r: i, c: lastCol },
    }));

    // 행 높이
    const rowHeights: any[] = [];
    rowHeights[0] = { hpt: 26 };
    rowHeights[1] = { hpt: 30 };
    rowHeights[2] = { hpt: 58 };
    rowHeights[3] = { hpt: 44 };
    rowHeights[guideRowIdx] = { hpt: 54 };
    rowHeights[exampleRowIdx] = { hpt: 20 };
    rowHeights[headerRowIdx] = { hpt: 26 };
    ws["!rows"] = rowHeights;

    const yellow = { patternType: "solid", fgColor: { rgb: "FFF2CC" } };
    const wrapTop = { vertical: "center", wrapText: true, horizontal: "left" as const };

    // 안내(병합) 행 스타일
    setStyle(XLSX, ws,0, 0, {
      fill: yellow,
      font: { bold: true, sz: 13, color: { rgb: "7F6000" } },
      alignment: { vertical: "center", horizontal: "left" },
    });
    for (let i = 1; i < notices.length; i++) {
      setStyle(XLSX, ws,i, 0, {
        fill: yellow,
        font: { sz: 10, color: { rgb: "7F6000" } },
        alignment: wrapTop,
      });
    }
    // 컬럼 설명 행
    for (let c = 0; c < nCols; c++) {
      setStyle(XLSX, ws,guideRowIdx, c, {
        fill: yellow,
        font: { sz: 9, italic: true, color: { rgb: "7F6000" } },
        alignment: { vertical: "top", wrapText: true, horizontal: "left" },
      });
      // 예시 행
      setStyle(XLSX, ws,exampleRowIdx, c, {
        fill: { patternType: "solid", fgColor: { rgb: "FFF9E6" } },
        font: { sz: 10, color: { rgb: "806000" } },
        alignment: { vertical: "center", horizontal: "left" },
      });
      // 제목(헤더) 행 — 파란 배경
      setStyle(XLSX, ws,headerRowIdx, c, {
        fill: { patternType: "solid", fgColor: { rgb: "2F5597" } },
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품등록");

    // 참고 시트 (카테고리 / 브랜드 목록) — 일반상품은 카테고리·브랜드가 없으므로 생략
    if (!isDirect) {
      const refAoa: any[][] = [["● 아래 값은 입력 시 정확히 일치시켜야 합니다 (참고용, 편집 불필요)"], [""]];
      refAoa.push(["[카테고리 목록]"]);
      if (categoryNames.length) categoryNames.forEach((n) => refAoa.push([n]));
      else refAoa.push(["(조회된 카테고리 없음)"]);
      if (mode === "admin") {
        refAoa.push([""], ["[브랜드 목록]"]);
        if (brands.length) brands.forEach((b) => refAoa.push([b.brandName]));
        else refAoa.push(["(등록된 브랜드 없음)"]);
      }
      const refWs = XLSX.utils.aoa_to_sheet(refAoa);
      refWs["!cols"] = [{ wch: 46 }];
      setStyle(XLSX, refWs, 0, 0, { font: { bold: true, color: { rgb: "2F5597" } } });
      XLSX.utils.book_append_sheet(wb, refWs, "참고");
    }

    const priceSuffix = isDirect ? "" : isCommission ? "_수수료방식" : showTypeStep ? "_공급가방식" : "";
    XLSX.writeFile(wb, `상품_대량등록_양식_${fileLabel}${priceSuffix}.xlsx`);
  };

  // ── 업로드 ──
  const handleUpload = async () => {
    if (!file) {
      appAlert("엑셀 파일을 선택해주세요");
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // 카탈로그(브랜드/관리자/중간관리자) 대량등록만 제공 방식 전달 (셀러 직접상품은 미전달)
      if (isCommission) fd.append("priceType", "COMMISSION");
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        await appAlert(d.error || `업로드 실패 (${res.status})`);
        return;
      }
      setResult({
        total: d.total ?? 0,
        successCount: d.successCount ?? 0,
        failedCount: d.failedCount ?? 0,
        results: Array.isArray(d.results) ? d.results : [],
      });
    } catch {
      await appAlert("업로드 중 오류가 발생했습니다. 네트워크 상태를 확인 후 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
  };

  // 대량등록 시작: 카탈로그(브랜드/관리자/중간관리자)는 유형 선택 팝업부터, 그 외는 바로 엑셀 모달
  const startBulk = () => {
    if (showTypeStep) {
      setPriceType("SUPPLY_PRICE");
      setTypeOpen(true);
    } else {
      setOpen(true);
    }
  };

  // 유형 선택 → 엑셀 업로드 모달로 진행
  const proceedFromType = () => {
    setTypeOpen(false);
    setFile(null);
    setResult(null);
    setOpen(true);
  };

  const failedRows = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <>
      <button
        onClick={startBulk}
        className="text-sm flex items-center gap-1 !px-3 !py-2 sm:!px-4 sm:!py-2.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
      >
        <FileSpreadsheet size={16} />
        <span className="hidden sm:inline">대량 등록</span>
        <span className="sm:hidden">대량</span>
      </button>

      {/* 유형(제공 방식) 선택 팝업 */}
      {typeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-gray-900">대량등록 방식 선택</h3>
              <button
                onClick={() => setTypeOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">등록할 상품의 가격 제공 방식을 선택하세요.</p>

            <div className="space-y-2.5">
              {/* 공급가로 제공 */}
              <button
                type="button"
                onClick={() => setPriceType("SUPPLY_PRICE")}
                className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  priceType === "SUPPLY_PRICE"
                    ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`mt-0.5 flex-shrink-0 ${priceType === "SUPPLY_PRICE" ? "text-brand-600" : "text-gray-400"}`}>
                  <Package size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">공급가로 제공</span>
                  <span className="block text-xs text-gray-500 mt-0.5">기존 엑셀 양식 사용 (공급가 입력)</span>
                </span>
                <span
                  className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    priceType === "SUPPLY_PRICE" ? "border-brand-600 bg-brand-600" : "border-gray-300"
                  }`}
                />
              </button>

              {/* 수수료로 제공 */}
              <button
                type="button"
                onClick={() => setPriceType("COMMISSION")}
                className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  priceType === "COMMISSION"
                    ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className={`mt-0.5 flex-shrink-0 ${priceType === "COMMISSION" ? "text-brand-600" : "text-gray-400"}`}>
                  <Percent size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">수수료로 제공</span>
                  <span className="block text-xs text-gray-500 mt-0.5">수수료 방식 엑셀 양식 (판매가 + 셀러수수료율)</span>
                </span>
                <span
                  className={`mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    priceType === "COMMISSION" ? "border-brand-600 bg-brand-600" : "border-gray-300"
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setTypeOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={proceedFromType}
                className="px-4 py-2 text-sm text-white bg-brand-600 rounded-lg hover:bg-brand-700 font-medium transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl sm:shadow-2xl sm:my-6 min-h-screen sm:min-h-0 flex flex-col max-h-screen sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex-shrink-0 px-4 sm:px-6 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <FileSpreadsheet size={20} className="text-brand-600" />
                <h3 className="text-lg font-bold text-gray-900">{isDirect ? "일반상품 대량 등록" : "상품 대량 등록"}</h3>
                {showTypeStep && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isCommission ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"
                  }`}>
                    {isCommission ? <Percent size={11} /> : <Package size={11} />}
                    {isCommission ? "수수료 제공" : "공급가 제공"}
                  </span>
                )}
              </div>
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
              {/* 1단계: 템플릿 다운로드 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                  <span className="text-sm font-semibold text-gray-800">엑셀 양식 다운로드</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed pl-7">
                  양식 상단의 노란색 안내 행에 작성 방법과 예시가 있습니다. <b>안내 행은 삭제하고</b> 제목 행 아래에 상품 정보만 입력하세요.
                  이미지는 URL로 입력합니다.
                </p>
                <div className="pl-7">
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium transition-colors"
                  >
                    <Download size={16} /> 템플릿 다운로드 (.xlsx)
                  </button>
                </div>
              </div>

              {/* 2단계: 업로드 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                  <span className="text-sm font-semibold text-gray-800">작성한 엑셀 파일 업로드</span>
                </div>
                <div className="pl-7 space-y-2">
                  <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-gray-300 cursor-pointer hover:border-brand-400 hover:bg-brand-50/40 transition-colors">
                    <Table2 size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600 truncate">
                      {file ? file.name : "엑셀 파일 선택 (.xlsx, .xls)"}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="hidden"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setResult(null);
                      }}
                    />
                  </label>
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? "등록 중..." : "업로드 후 일괄 등록"}
                  </button>
                </div>
              </div>

              {/* 결과 */}
              {result && (
                <div className="space-y-3 border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold">
                      <CheckCircle2 size={15} /> 성공 {result.successCount}건
                    </span>
                    {result.failedCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-semibold">
                        <AlertTriangle size={15} /> 실패 {result.failedCount}건
                      </span>
                    )}
                    <span className="text-xs text-gray-400">총 {result.total}건 처리</span>
                  </div>

                  {failedRows.length > 0 && (
                    <div className="border border-red-100 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-red-50 text-xs font-semibold text-red-700 border-b border-red-100">
                        실패 행 (해당 행을 수정 후 다시 업로드하세요)
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                        {failedRows.map((r, i) => (
                          <div key={i} className="px-3 py-2 text-xs flex gap-2">
                            <span className="text-gray-400 flex-shrink-0 font-mono">{r.row}행</span>
                            <span className="text-gray-700 flex-shrink-0 max-w-[120px] truncate">{r.name}</span>
                            <span className="text-red-500 flex-1">{r.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.successCount > 0 && (
                    <button
                      onClick={() => {
                        // onSuccess 가 있으면 목록만 갱신하고 모달을 닫는다(탭 상태 유지). 없으면 페이지 새로고침.
                        if (onSuccess) {
                          onSuccess();
                          close();
                        } else {
                          window.location.reload();
                        }
                      }}
                      className="w-full text-sm px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                    >
                      목록 새로고침하여 등록 결과 확인
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
