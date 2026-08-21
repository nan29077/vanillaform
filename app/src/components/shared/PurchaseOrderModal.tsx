"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useState } from "react";
import {X, Loader2, User as UserIcon, Phone, MapPin, Printer, Building2, CreditCard, Package, Store, FileText} from 'lucide-react';

// 바닐라 플라워 테마 캘린더 아이콘 — lucide 컴포넌트 자리(Row icon)에 그대로 사용 가능
const BeeCalendarIcon = ({ size = 12 }: { size?: number }) => <Icon name="Calendar" size={size} />;

interface POItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  price: number;
  totalPrice: number;
  thumbnail: string | null;
  supplierType: string;
  supplierName: string;
  managerName?: string | null;
}

interface PurchaseOrder {
  poNumber: string;
  orderNumber: string;
  orderDate: string;
  paidAt: string | null;
  status: string;
  campaignTitle: string | null;
  buyer: { name: string; email: string; phone: string; address: string };
  seller: { shopName: string; sellerName: string };
  payment: {
    totalAmount: number;
    shippingFee: number;
    discountAmount: number;
    finalAmount: number;
    method: string;
    itemsTotal: number;
    partial: boolean;
  };
  shipping: {
    name: string;
    phone: string;
    address: string;
    memo: string;
    shippedAt: string | null;
  };
  items: POItem[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기", PAID: "결제완료", CONFIRMED: "확인됨", SHIPPING: "배송중",
  DELIVERED: "배송완료", CANCELLED: "취소됨", REFUND_REQUESTED: "환불요청", REFUNDED: "환불완료",
};

const won = (n: number) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// 발주서 인쇄용 HTML 생성 → 새 창에서 window.print()
function buildPrintHtml(po: PurchaseOrder): string {
  const itemRows = po.items
    .map(
      (it) => `
    <tr>
      <td>${escapeHtml(it.productName)}</td>
      <td style="text-align:center">${escapeHtml(it.variantName) || "-"}</td>
      <td style="text-align:center">${escapeHtml(it.supplierType)} · ${escapeHtml(it.supplierName)}${it.managerName ? `<br><span style="font-size:10px;color:#6b7280">관리 중간관리자: ${escapeHtml(it.managerName)}</span>` : ""}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right">${won(it.price)}</td>
      <td style="text-align:right">${won(it.totalPrice)}</td>
    </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>발주서 ${escapeHtml(po.poNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Malgun Gothic", "맑은 고딕", sans-serif; color:#1f2937; margin:0; padding:24px; background:#f3f4f6; }
  .toolbar { max-width:760px; margin:0 auto 16px; display:flex; justify-content:space-between; align-items:center; }
  .toolbar button { font-size:13px; padding:8px 14px; border:0; border-radius:8px; background:#111827; color:#fff; cursor:pointer; }
  .sheet { max-width:760px; margin:0 auto; background:#fff; padding:32px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .sheet-head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #111827; padding-bottom:10px; margin-bottom:16px; }
  .sheet-head h1 { font-size:24px; margin:0; letter-spacing:6px; }
  .sheet-head .ono { font-size:13px; color:#6b7280; font-weight:600; }
  h2 { font-size:13px; margin:18px 0 6px; color:#374151; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  table.meta th { width:80px; text-align:left; background:#f9fafb; color:#6b7280; font-weight:600; padding:6px 8px; border:1px solid #e5e7eb; }
  table.meta td { padding:6px 8px; border:1px solid #e5e7eb; }
  table.items th { background:#f3f4f6; padding:7px 8px; border:1px solid #e5e7eb; text-align:left; }
  table.items td { padding:7px 8px; border:1px solid #e5e7eb; }
  table.totals { width:280px; margin-left:auto; margin-top:10px; }
  table.totals th { text-align:left; color:#6b7280; font-weight:500; padding:5px 8px; }
  table.totals td { text-align:right; padding:5px 8px; }
  table.totals tr.grand th, table.totals tr.grand td { border-top:1px solid #d1d5db; font-weight:800; font-size:14px; color:#111827; padding-top:8px; }
  .note { font-size:11px; color:#9ca3af; margin-top:8px; }
  @media print {
    body { background:#fff; padding:0; }
    .toolbar { display:none; }
    .sheet { box-shadow:none; border-radius:0; margin:0; max-width:none; padding:16mm; }
  }
</style></head>
<body>
  <div class="toolbar">
    <span style="font-size:13px;color:#6b7280">발주서 · ${escapeHtml(po.poNumber)}</span>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  <section class="sheet">
    <div class="sheet-head">
      <h1>발주서</h1>
      <div class="ono">${escapeHtml(po.poNumber)}</div>
    </div>
    <table class="meta">
      <tr><th>발주일시</th><td>${fmt(po.orderDate)}</td><th>결제일시</th><td>${fmt(po.paidAt)}</td></tr>
      <tr><th>주문번호</th><td>${escapeHtml(po.orderNumber)}</td><th>주문상태</th><td>${STATUS_LABEL[po.status] || escapeHtml(po.status)}</td></tr>
      ${po.campaignTitle ? `<tr><th>공동구매</th><td colspan="3">${escapeHtml(po.campaignTitle)}</td></tr>` : ""}
    </table>

    <h2>구매자 정보</h2>
    <table class="meta">
      <tr><th>이름</th><td>${escapeHtml(po.buyer.name) || "-"}</td><th>연락처</th><td>${escapeHtml(po.buyer.phone) || "-"}</td></tr>
      <tr><th>배송지</th><td colspan="3">${escapeHtml(po.buyer.address) || "-"}</td></tr>
    </table>

    <h2>셀러 정보</h2>
    <table class="meta">
      <tr><th>샵명</th><td>${escapeHtml(po.seller.shopName) || "-"}</td><th>셀러명</th><td>${escapeHtml(po.seller.sellerName) || "-"}</td></tr>
    </table>

    <h2>발주 상품</h2>
    <table class="items">
      <thead><tr><th>상품명</th><th style="width:100px">옵션</th><th style="width:150px">공급자</th><th style="width:50px">수량</th><th style="width:80px">단가</th><th style="width:90px">합계</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <h2>결제 정보</h2>
    <table class="meta">
      <tr><th>결제방법</th><td>${escapeHtml(po.payment.method)}</td><th>상품합계</th><td>${won(po.payment.itemsTotal)}</td></tr>
    </table>
    <table class="totals">
      <tr><th>상품 합계</th><td>${won(po.payment.totalAmount)}</td></tr>
      <tr><th>배송비</th><td>${won(po.payment.shippingFee)}</td></tr>
      ${po.payment.discountAmount > 0 ? `<tr><th>할인</th><td>-${won(po.payment.discountAmount)}</td></tr>` : ""}
      <tr class="grand"><th>최종 결제금액</th><td>${won(po.payment.finalAmount)}</td></tr>
    </table>
    ${po.payment.partial ? `<p class="note">※ 본 발주서에는 귀하가 공급한 상품만 표시되며, 결제금액은 주문 전체 기준입니다.</p>` : ""}

    <h2>배송 정보</h2>
    <table class="meta">
      <tr><th>수령인</th><td>${escapeHtml(po.shipping.name) || "-"}</td><th>연락처</th><td>${escapeHtml(po.shipping.phone) || "-"}</td></tr>
      <tr><th>주소</th><td colspan="3">${escapeHtml(po.shipping.address) || "-"}</td></tr>
      ${po.shipping.memo ? `<tr><th>배송메모</th><td colspan="3">${escapeHtml(po.shipping.memo)}</td></tr>` : ""}
      ${po.shipping.shippedAt ? `<tr><th>배송시작</th><td colspan="3">${fmt(po.shipping.shippedAt)}</td></tr>` : ""}
    </table>
  </section>
</body></html>`;
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-gray-500 flex items-center gap-1 shrink-0">
        <Icon size={12} /> {label}
      </span>
      <span className="text-gray-800 text-right break-words">{value || "-"}</span>
    </div>
  );
}

export default function PurchaseOrderModal({
  orderId,
  role,
  onClose,
}: {
  orderId: string;
  role?: string;
  onClose: () => void;
}) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/purchase-order`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "발주서를 불러오지 못했습니다.");
        if (alive) setPo(data);
      } catch (e: any) {
        if (alive) setErr(e.message || "발주서를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const handlePrint = () => {
    if (!po) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPrintHtml(po));
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl my-8">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
            <Icon name="File" size={16} /> 발주서
          </h3>
          <div className="flex items-center gap-2">
            {po && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
              >
                <Printer size={13} /> 인쇄 / PDF
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : err ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-5">
            <p className="text-sm font-semibold text-red-500">{err}</p>
          </div>
        ) : po ? (
          <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
            {/* 발주 기본 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Icon name="File" size={12} /> 발주 정보
                </p>
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  {po.poNumber}
                </span>
              </div>
              <Row icon={BeeCalendarIcon} label="발주일시" value={fmt(po.orderDate)} />
              <Row icon={CreditCard} label="주문상태" value={STATUS_LABEL[po.status] || po.status} />
              {po.campaignTitle && <Row icon={Package} label="공동구매" value={po.campaignTitle} />}
            </div>

            {/* 구매자 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Icon name="MyPage" size={12} /> 구매자 정보
              </p>
              <Row icon={UserIcon} label="이름" value={po.buyer.name} />
              <Row icon={Phone} label="연락처" value={po.buyer.phone} />
              <Row icon={MapPin} label="배송지" value={po.buyer.address} />
            </div>

            {/* 셀러 정보 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Icon name="Store" size={12} /> 셀러 정보
              </p>
              <Row icon={Store} label="샵명" value={po.seller.shopName} />
              <Row icon={UserIcon} label="셀러명" value={po.seller.sellerName} />
            </div>

            {/* 발주 상품 (상품별 공급자 포함) */}
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                <Icon name="Package" size={12} /> 발주 상품
              </p>
              <div className="space-y-2">
                {po.items.map((it) => (
                  <div key={it.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-11 h-11 rounded-md bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {it.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="Package" size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{it.productName}</p>
                        {it.variantName && (
                          <p className="text-[10px] text-gray-500 mt-0.5">옵션 · {it.variantName}</p>
                        )}
                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <Building2 size={10} />
                          <span className="font-semibold text-gray-600">{it.supplierType}</span> · {it.supplierName}
                        </p>
                        {it.managerName && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            관리 중간관리자 · {it.managerName}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[11px] text-gray-600">{won(it.price)} x {it.quantity}</p>
                        <p className="text-xs font-bold text-gray-900">{won(it.totalPrice)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 결제 정보 */}
            <div className="bg-brand-50 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <Icon name="CreditCard" size={12} /> 결제 정보
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">결제방법</span>
                <span className="text-gray-800">{po.payment.method}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">상품 합계</span>
                <span>{won(po.payment.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">배송비</span>
                <span>{won(po.payment.shippingFee)}</span>
              </div>
              {po.payment.discountAmount > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">할인</span>
                  <span className="text-red-500">-{won(po.payment.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-brand-100">
                <span className="text-sm font-bold text-gray-900">최종 결제금액</span>
                <span className="text-sm font-extrabold text-brand-600">{won(po.payment.finalAmount)}</span>
              </div>
              {po.payment.partial && (
                <p className="text-[10px] text-gray-400 mt-1">
                  ※ 본 발주서에는 귀하가 공급한 상품만 표시되며, 결제금액은 주문 전체 기준입니다.
                </p>
              )}
            </div>

            {/* 배송 정보 */}
            {po.shipping.name && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Icon name="Truck" size={12} /> 배송 정보
                </p>
                <Row icon={UserIcon} label="수령인" value={po.shipping.name} />
                <Row icon={Phone} label="연락처" value={po.shipping.phone} />
                <Row icon={MapPin} label="주소" value={po.shipping.address} />
                {po.shipping.memo && <Row icon={FileText} label="배송메모" value={po.shipping.memo} />}
                {po.shipping.shippedAt && <Row icon={BeeCalendarIcon} label="배송시작" value={fmt(po.shipping.shippedAt)} />}
              </div>
            )}
          </div>
        ) : null}

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
