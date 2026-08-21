"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useMemo } from "react";
import {X, ChevronRight, SortAsc, SortDesc, ArrowUpDown, Truck, CreditCard, Clock, CheckCircle2, XCircle, RotateCcw, AlertTriangle, DollarSign, Share2, Printer, Calculator, Building2, Loader2, Phone, Ban} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import { paymentMethodLabel } from "@/lib/payment";
import type { OrderFeeInfo, OrderFeeLine } from "@/lib/orderFee";
import PurchaseOrderModal from "@/components/shared/PurchaseOrderModal";
import Pagination, { usePagination } from "@/components/shared/Pagination";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "결제대기", color: "bg-gray-100 text-gray-600", icon: Clock },
  PAID: { label: "결제완료", color: "bg-blue-50 text-blue-600", icon: CreditCard },
  CONFIRMED: { label: "확인됨", color: "bg-indigo-50 text-indigo-600", icon: CheckCircle2 },
  SHIPPING: { label: "배송중", color: "bg-cyan-50 text-cyan-600", icon: Truck },
  DELIVERED: { label: "배송완료", color: "bg-green-50 text-green-600", icon: CheckCircle2 },
  CANCELLED: { label: "취소됨", color: "bg-red-50 text-red-600", icon: XCircle },
  REFUND_REQUESTED: { label: "환불요청", color: "bg-orange-50 text-orange-600", icon: RotateCcw },
  REFUNDED: { label: "환불완료", color: "bg-gray-100 text-gray-500", icon: RotateCcw },
};

type OrderType = "all" | "normal" | "groupbuy" | "live" | "myproduct";

// 바닐라 플라워 테마 날짜 입력 — 브라우저 기본 캘린더 아이콘을 투명 처리하고
// 그 위에 커스텀 바닐라 플라워 캘린더 아이콘(/icons/Calendar.png)을 겹쳐 표시한다.
// (아이콘 영역 클릭 시 투명한 네이티브 인디케이터가 눌려 DatePicker가 그대로 열림)
function BeeDateInput({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) {
  return (
    <div className="relative">
      <input
        type="date"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-xl pl-2.5 pr-8 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-1.5 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
        <Icon name="Calendar" size={15} />
      </span>
    </div>
  );
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantName?: string | null;
  price: number;
  quantity: number;
  totalPrice: number;
  thumbnail?: string | null;
  // 발주서 구분 필터용 공급자 메타(중간관리자/브랜드 페이지에서만 채워짐)
  productMiddleAdminId?: string | null; // 상품 직접 등록 중간관리자
  brandId?: string | null; // 상품의 브랜드 id
  brandMiddleAdminId?: string | null; // 브랜드를 관리하는 중간관리자
}

interface Order {
  id: string;
  orderNumber: string;
  userName: string;
  userEmail?: string;
  sellerName: string;
  sellerId?: string;
  brandName?: string | null;
  brandId?: string | null;
  finalAmount: number;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  discountType?: string | null;
  status: string;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  campaignId?: string | null;
  campaignTitle?: string | null;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: string | null;
  shippingMemo?: string | null;
  snsAccounts?: { platform: string; handle: string }[] | null;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  thumbnail?: string | null;
  items: OrderItem[];
  canViewDetail?: boolean;
  feeInfo?: OrderFeeInfo | null;
  deliveryStatus?: string | null;
  deliveryCourier?: string | null;
  deliveryTracking?: string | null;
  deliveryUpdatedAt?: string | null;
  // 결제취소 필드
  cancelStatus?: string | null;
  cancelType?: string | null;
  cancelAmount?: number | null;
  cancelFromSettlement?: boolean | null;
  // 패키지 주문 여부
  isPackageOrder?: boolean;
}

// 정산 수수료 안내 라인 색상
const STATUS_TONE: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-600 border-blue-100",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
  excluded: "bg-red-50 text-red-500 border-red-100",
};

function feeLineClass(l: OrderFeeLine): string {
  const weight = l.strong ? " font-bold" : " font-medium";
  if (l.tone === "fee") return "text-red-500" + weight;
  if (l.tone === "settle") return "text-brand-600" + weight;
  if (l.tone === "muted") return "text-gray-400" + weight;
  return "text-gray-800" + weight;
}

// 주문 상세보기 · 정산 수수료 안내 섹션 (펼침 영역/상세 모달 공용)
function OrderFeeSection({ fee }: { fee: OrderFeeInfo }) {
  const badge = STATUS_TONE[fee.statusTone] || STATUS_TONE.pending;
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1">
          <Icon name="Receipt" size={12} /> 정산 수수료 안내
        </p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${badge}`}>
          {fee.statusLabel}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 flex items-center gap-1">
        <Calculator size={10} /> {fee.viewpointLabel}
      </p>
      <div className="space-y-2">
        {fee.items.map((card, ci) => (
          <div key={ci} className="bg-white rounded-lg border border-gray-100 p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[11px] font-semibold text-gray-800 truncate">
                {card.title}
                {card.option && <span className="text-gray-400 font-normal"> · {card.option}</span>}
              </p>
              <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {card.typeLabel}
              </span>
            </div>
            <div className="space-y-1">
              {card.lines.map((l, li) => (
                <div key={li} className="flex justify-between gap-2 text-[11px]">
                  <span className="text-gray-500">{l.label}</span>
                  <span className={feeLineClass(l)}>{l.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {fee.summary.length > 0 && (
        <div className="pt-2 border-t border-gray-200 space-y-1">
          {fee.summary.map((l, i) => (
            <div key={i} className="flex justify-between gap-2 text-xs">
              <span className="text-gray-600">{l.label}</span>
              <span className={feeLineClass(l)}>{l.value}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-400 flex items-center gap-1">
        <Icon name="Wallet" size={10} /> 실제 정산액은 환불·정산일 규칙에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}

interface Props {
  orders: Order[];
  role: "SUPER_ADMIN" | "SELLER" | "BRAND_ADMIN";
  sellers?: { id: string; name: string }[];
  brands?: { id: string; name: string }[];
  // 발주서 구분 필터: "admin"(최고관리자) / "middle"(중간관리자). 미지정 시 미표시
  poFilter?: "admin" | "middle";
  middleAdmins?: { id: string; name: string }[]; // 최고관리자용 중간관리자 목록
  currentMiddleId?: string; // 중간관리자 페이지: 본인 중간관리자 id
  brandManagerMap?: Record<string, string>; // brandId → 관리 중간관리자명(표시용)
  canManageDelivery?: boolean; // true: 배송 상태 수정 가능 (SUPER_ADMIN, BRAND_ADMIN, MIDDLE_ADMIN)
}

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
const formatDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");
const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString("ko-KR") : "-";

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PAYMENT_COMPLETED:  { label: "결제 완료",        color: "bg-blue-50 text-blue-600 border-blue-100" },
  PREPARING:          { label: "상품 준비 중",      color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  SHIPPED:            { label: "배송 준비",          color: "bg-orange-50 text-orange-600 border-orange-100" },
  DELIVERING:         { label: "배송 중",            color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  DELIVERED:          { label: "배송 완료",          color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  CANCELLED:          { label: "취소",               color: "bg-red-50 text-red-500 border-red-100" },
  CANCEL_REQUESTED:   { label: "결제취소 요청중",    color: "bg-amber-50 text-amber-700 border-amber-100" },
  CANCEL_COMPLETED:   { label: "결제취소 완료",      color: "bg-gray-100 text-gray-500 border-gray-200" },
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기", PAID: "결제완료", CONFIRMED: "확인됨", SHIPPING: "배송중",
  DELIVERED: "배송완료", CANCELLED: "취소됨", REFUND_REQUESTED: "환불요청", REFUNDED: "환불완료",
};

/* ── 배송 처리 모달 ── */
function DeliveryModal({
  orderId,
  current,
  onClose,
  onSaved,
}: {
  orderId: string;
  current: { status?: string | null; courier?: string | null; tracking?: string | null };
  onClose: () => void;
  onSaved: (updated: { deliveryStatus: string; deliveryCourier: string | null; deliveryTracking: string | null }) => void;
}) {
  const [status, setStatus] = useState(current.status || "PAYMENT_COMPLETED");
  const [courier, setCourier] = useState(current.courier || "");
  const [tracking, setTracking] = useState(current.tracking || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryStatus: status, deliveryCourier: courier || null, deliveryTracking: tracking || null }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "저장에 실패했습니다."); return; }
      onSaved({ deliveryStatus: status, deliveryCourier: courier || null, deliveryTracking: tracking || null });
      onClose();
    } catch {
      setErr("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Icon name="Truck" size={16} className="text-brand-500" />
            <h2 className="text-[15px] font-bold text-gray-900">배송 처리</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">배송 상태</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-[13px] text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {Object.entries(DELIVERY_STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">택배사</label>
            <input
              type="text"
              value={courier}
              onChange={e => setCourier(e.target.value)}
              placeholder="예: CJ대한통운"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-[13px] text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">운송장 번호</label>
            <input
              type="text"
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              placeholder="운송장 번호 입력"
              className="w-full h-10 border border-gray-200 rounded-xl px-3 text-[13px] text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          {err && <p className="text-[12px] text-red-500">{err}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 h-11 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50">취소</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Icon name="Share" size={15} />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── cancelStatus 뱃지 텍스트/색상 ── */
const CANCEL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  REQUESTED:         { label: "결제취소 요청중",                       color: "bg-amber-50 text-amber-700 border-amber-200" },
  DEPOSIT_CONFIRMED_NORMAL: { label: "입금후 취소 요청중(입금완료)",     color: "bg-amber-50 text-amber-700 border-amber-200" },
  DEPOSIT_CONFIRMED_SETTLE: { label: "정산금 차감 입금완료 취소 요청중", color: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED:          { label: "결제취소 승인됨",                       color: "bg-orange-50 text-orange-600 border-orange-200" },
  COMPLETED:         { label: "결제취소 완료",                         color: "bg-gray-100 text-gray-500 border-gray-200" },
};

function getCancelBadgeKey(cancelStatus: string | null | undefined, cancelFromSettlement?: boolean | null): string | null {
  if (!cancelStatus) return null;
  if (cancelStatus === "DEPOSIT_CONFIRMED") {
    return cancelFromSettlement ? "DEPOSIT_CONFIRMED_SETTLE" : "DEPOSIT_CONFIRMED_NORMAL";
  }
  return cancelStatus;
}

/* ── 결제취소 요청 전 바닐라 플라워 확인 모달 ── */
function CancelConfirmModal({
  order,
  onConfirm,
  onClose,
}: {
  order: { orderNumber: string; finalAmount: number };
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[320px] bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-br from-amber-400 to-yellow-300 px-6 pt-6 pb-5 flex flex-col items-center gap-2">
          <p className="text-amber-900 font-extrabold text-[15px] text-center leading-snug">
            결제 취소를 정말로<br />요청하시겠습니까?
          </p>
        </div>

        {/* 주문 정보 */}
        <div className="px-5 py-4 space-y-2">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>주문번호</span>
              <span className="font-semibold text-gray-700">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>취소 요청 금액</span>
              <span className="font-bold text-amber-700">{order.finalAmount.toLocaleString("ko-KR")}원</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 text-center leading-relaxed px-1">
            취소 요청 후 관리자 승인이 필요합니다.<br />
            승인 전까지는 요청을 철회할 수 있습니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            돌아가기
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-2xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold transition-colors shadow-sm"
          >
            취소 요청하기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 결제취소 요청 모달 (POST_DAY 입금 안내용) ── */
function CancelRequestModal({
  orderId,
  cancelAmount,
  cancelType,
  cancelStatus,
  onClose,
  onDepositConfirmed,
}: {
  orderId: string;
  cancelAmount: number;
  cancelType: "SAME_DAY" | "POST_DAY";
  cancelStatus: string;
  onClose: () => void;
  onDepositConfirmed: () => void;
}) {
  const [depositing, setDepositing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleDeposit = async () => {
    setDepositing(true);
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel-deposit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "처리에 실패했습니다."); return; }
      onDepositConfirmed();
      onClose();
    } catch {
      setErr("처리 중 오류가 발생했습니다.");
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Ban size={16} className="text-amber-500" />
            <h2 className="text-[15px] font-bold text-gray-900">결제취소 요청 완료</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {cancelType === "SAME_DAY" ? (
            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
              <p className="font-bold mb-1">당일 결제취소 요청이 접수되었습니다.</p>
              <p className="text-[12px]">관리자 승인 후 PG 취소가 진행됩니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
                <p className="font-bold mb-1">결제일 이후 취소 요청이 접수되었습니다.</p>
                <p className="text-[12px]">취소 금액을 먼저 입금한 후 아래 버튼을 눌러주세요.</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">취소 금액</span>
                  <span className="font-bold text-gray-900">{cancelAmount.toLocaleString("ko-KR")}원</span>
                </div>
                <p className="text-[11px] text-gray-400">입금 완료 후 아래 버튼을 눌러야 처리됩니다.</p>
              </div>
              {cancelStatus === "REQUESTED" && (
                <>
                  {err && <p className="text-[12px] text-red-500">{err}</p>}
                  <button
                    onClick={handleDeposit}
                    disabled={depositing}
                    className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {depositing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    입금완료 확인
                  </button>
                </>
              )}
              {cancelStatus === "DEPOSIT_CONFIRMED" && (
                <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} /> 입금완료 확인됨 — 관리자 승인 대기 중
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full h-10 border border-gray-200 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-50">닫기</button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// 날짜별 주문서 일괄 출력용 인쇄 HTML 생성.
// 각 주문을 한 장(page-break)으로 구성하여 미리보기/PDF 저장/인쇄에 모두 사용한다.
function buildOrderSheetsHtml(orders: Order[], opts?: { autoPrint?: boolean; rangeLabel?: string }): string {
  const rows = orders.map((o, idx) => {
    const itemsRows = o.items.map((it) => `
      <tr>
        <td>${escapeHtml(it.productName)}</td>
        <td style="text-align:center">${escapeHtml(it.variantName) || "-"}</td>
        <td style="text-align:center">${it.quantity}</td>
        <td style="text-align:right">${formatPrice(it.price)}</td>
        <td style="text-align:right">${formatPrice(it.totalPrice)}</td>
      </tr>`).join("");

    return `
    <section class="sheet${idx < orders.length - 1 ? " page-break" : ""}">
      <div class="sheet-head">
        <h1>주문서</h1>
        <div class="ono">${escapeHtml(o.orderNumber)}</div>
      </div>
      <table class="meta">
        <tr><th>주문일시</th><td>${formatDateTime(o.createdAt)}</td><th>결제일시</th><td>${formatDateTime(o.paidAt || null)}</td></tr>
        <tr><th>주문상태</th><td>${STATUS_LABEL[o.status] || escapeHtml(o.status)}</td><th>결제수단</th><td>${escapeHtml(paymentMethodLabel(o.paymentMethod))}</td></tr>
        <tr><th>주문자</th><td>${escapeHtml(o.userName)}</td><th>라이브 셀러</th><td>${escapeHtml(o.sellerName)}</td></tr>
        ${o.campaignTitle ? `<tr><th>공동구매</th><td colspan="3">${escapeHtml(o.campaignTitle)}</td></tr>` : ""}
      </table>

      <h2>배송 정보</h2>
      <table class="meta">
        <tr><th>수령인</th><td>${escapeHtml(o.shippingName) || "-"}</td><th>연락처</th><td>${escapeHtml(o.shippingPhone) || "-"}</td></tr>
        <tr><th>주소</th><td colspan="3">${escapeHtml(o.shippingAddress) || "-"}</td></tr>
        ${o.shippingMemo ? `<tr><th>배송메모</th><td colspan="3">${escapeHtml(o.shippingMemo)}</td></tr>` : ""}
      </table>

      <h2>주문 상품</h2>
      <table class="items">
        <thead><tr><th>상품명</th><th style="width:120px">옵션</th><th style="width:50px">수량</th><th style="width:90px">단가</th><th style="width:100px">금액</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <table class="totals">
        <tr><th>상품 합계</th><td>${formatPrice(o.totalAmount)}</td></tr>
        <tr><th>배송비</th><td>${formatPrice(o.shippingFee)}</td></tr>
        ${o.discountAmount > 0 ? `<tr><th>할인</th><td>-${formatPrice(o.discountAmount)}</td></tr>` : ""}
        <tr class="grand"><th>최종 결제금액</th><td>${formatPrice(o.finalAmount)}</td></tr>
      </table>
    </section>`;
  }).join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>주문서 일괄 출력</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Malgun Gothic", "맑은 고딕", sans-serif; color: #1f2937; margin: 0; padding: 24px; background:#f3f4f6; }
  .toolbar { max-width: 760px; margin: 0 auto 16px; display:flex; justify-content:space-between; align-items:center; }
  .toolbar .info { font-size: 13px; color:#6b7280; }
  .toolbar button { font-size: 13px; padding: 8px 14px; border:0; border-radius: 8px; background:#111827; color:#fff; cursor:pointer; }
  .sheet { max-width: 760px; margin: 0 auto 16px; background:#fff; padding: 32px; border-radius: 8px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .sheet-head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 16px; }
  .sheet-head h1 { font-size: 24px; margin:0; letter-spacing: 4px; }
  .sheet-head .ono { font-size: 13px; color:#6b7280; font-weight:600; }
  h2 { font-size: 13px; margin: 18px 0 6px; color:#374151; }
  table { width:100%; border-collapse: collapse; font-size: 12px; }
  table.meta th { width: 80px; text-align:left; background:#f9fafb; color:#6b7280; font-weight:600; padding:6px 8px; border:1px solid #e5e7eb; }
  table.meta td { padding:6px 8px; border:1px solid #e5e7eb; }
  table.items th { background:#f3f4f6; padding:7px 8px; border:1px solid #e5e7eb; text-align:left; }
  table.items td { padding:7px 8px; border:1px solid #e5e7eb; }
  table.totals { width: 280px; margin-left:auto; margin-top:10px; }
  table.totals th { text-align:left; color:#6b7280; font-weight:500; padding:5px 8px; }
  table.totals td { text-align:right; padding:5px 8px; }
  table.totals tr.grand th, table.totals tr.grand td { border-top:1px solid #d1d5db; font-weight:800; font-size:14px; color:#111827; padding-top:8px; }
  @media print {
    body { background:#fff; padding:0; }
    .toolbar { display:none; }
    .sheet { box-shadow:none; border-radius:0; margin:0; max-width:none; padding: 16mm; }
    .page-break { page-break-after: always; }
  }
</style></head>
<body>
  <div class="toolbar">
    <span class="info">${escapeHtml(opts?.rangeLabel || "")} · 총 ${orders.length}건</span>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  ${rows || '<div class="sheet"><p style="text-align:center;color:#9ca3af">출력할 주문서가 없습니다.</p></div>'}
  ${opts?.autoPrint ? "<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>" : ""}
</body></html>`;
}

function getDateRange(period: string): Date {
  const now = new Date();
  switch (period) {
    case "1w": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "1m": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3m": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default: return new Date(0);
  }
}

export default function OrderManagementClient({
  orders, role, sellers = [], brands = [],
  poFilter, middleAdmins = [], currentMiddleId, brandManagerMap = {},
  canManageDelivery = false,
}: Props) {
  const { appAlert } = useAppDialog();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  // ── 발주서 구분 필터 상태 ──
  // 중간관리자: 전체 / 내가 등록한 상품(mine) / 하위 브랜드별(brand)
  const [poScope, setPoScope] = useState<"all" | "mine" | "brand">("all");
  const [poScopeBrand, setPoScopeBrand] = useState("all");
  // 최고관리자: 전체 / 셀러별 / 중간관리자별 / 브랜드별 / 패키지상품
  const [poType, setPoType] = useState<"all" | "seller" | "middle" | "brand" | "package">("all");
  const [poSellerSel, setPoSellerSel] = useState("all");
  const [poMiddleSel, setPoMiddleSel] = useState("all");
  const [poMiddleSub, setPoMiddleSub] = useState<"all" | "own" | "subbrand">("all");
  const [poBrandSel, setPoBrandSel] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [poOrderId, setPoOrderId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showBulkSheet, setShowBulkSheet] = useState(false);
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [deliveryUpdates, setDeliveryUpdates] = useState<Record<string, { deliveryStatus: string; deliveryCourier: string | null; deliveryTracking: string | null }>>({});
  // 결제취소 상태
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null); // 취소 모달에 표시할 주문
  const [cancelModalState, setCancelModalState] = useState<{ cancelType: "SAME_DAY" | "POST_DAY"; cancelStatus: string; cancelAmount: number } | null>(null);
  const [cancelUpdates, setCancelUpdates] = useState<Record<string, { cancelStatus: string; cancelType: string; cancelAmount: number; cancelFromSettlement: boolean }>>({});
  const [cancelRequesting, setCancelRequesting] = useState<string | null>(null); // 요청 중인 orderId
  const [cancelApproving, setCancelApproving] = useState<string | null>(null); // 승인 중인 orderId (관리자) // 낙관적 배송 상태 업데이트
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<Order | null>(null); // 확인 모달용
  const [cancelWithdrawing, setCancelWithdrawing] = useState<string | null>(null); // 철회 처리 중인 orderId
  // ── 날짜 필터 "적용" 전 임시 상태 ──
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");
  // ── 배송상태 필터 ──
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");

  const classifyOrder = (order: Order): OrderType => {
    if (order.campaignId) return "groupbuy";
    if (order.discountType === "live") return "live";
    return "normal";
  };

  // 상태 필터를 제외한 모든 필터를 적용한 결과.
  // 상태별 카드 건수(statusCounts)는 이 집합에서 계산해야 초기 로드 시부터
  // 각 상태의 실제 건수가 표시되고, 한 카드를 클릭해도 다른 카드가 0으로 사라지지 않는다.
  const baseFiltered = useMemo(() => {
    let result = orders;

    // Seller filter
    if (sellerFilter !== "all") {
      result = result.filter(o => o.sellerId === sellerFilter);
    }

    // Brand filter
    if (brandFilter !== "all") {
      result = result.filter(o => o.brandId === brandFilter);
    }

    // ── 발주서 구분 필터 (중간관리자) ──
    if (poFilter === "middle") {
      if (poScope === "mine") {
        result = result.filter(o => o.items.some(i => i.productMiddleAdminId === currentMiddleId));
      } else if (poScope === "brand") {
        result = poScopeBrand === "all"
          ? result.filter(o => o.items.some(i => i.brandMiddleAdminId === currentMiddleId))
          : result.filter(o => o.items.some(i => i.brandId === poScopeBrand));
      }
    }

    // ── 발주서 구분 필터 (최고관리자) ──
    if (poFilter === "admin") {
      if (poType === "seller" && poSellerSel !== "all") {
        result = result.filter(o => o.sellerId === poSellerSel);
      } else if (poType === "middle" && poMiddleSel !== "all") {
        result = result.filter(o => o.items.some(i => {
          const own = i.productMiddleAdminId === poMiddleSel;
          const sub = i.brandMiddleAdminId === poMiddleSel;
          if (poMiddleSub === "own") return own;
          if (poMiddleSub === "subbrand") return sub;
          return own || sub;
        }));
      } else if (poType === "brand" && poBrandSel !== "all") {
        result = result.filter(o => o.items.some(i => i.brandId === poBrandSel));
      } else if (poType === "package") {
        result = result.filter(o => o.isPackageOrder === true);
      }
    }

    // Date range filter
    // 버그 수정: new Date("YYYY-MM-DD") 는 UTC 자정으로 파싱되어 KST 오전 주문(=전날 UTC)이
    //   당일 필터에서 누락됨. 로컬 시간대의 하루(00:00:00 ~ 23:59:59.999)로 해석하도록 수정.
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      result = result.filter(o => new Date(o.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`);
      result = result.filter(o => new Date(o.createdAt) <= to);
    }

    // Delivery status filter
    if (deliveryStatusFilter !== "all") {
      result = result.filter(o => {
        const ds = deliveryUpdates[o.id]?.deliveryStatus ?? o.deliveryStatus;
        return ds === deliveryStatusFilter;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        o =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.userName.toLowerCase().includes(q) ||
          o.sellerName.toLowerCase().includes(q) ||
          (o.brandName && o.brandName.toLowerCase().includes(q)) ||
          o.items.some(it => it.productName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [
    orders, sellerFilter, brandFilter, searchQuery, dateFrom, dateTo,
    poFilter, currentMiddleId, poScope, poScopeBrand,
    poType, poSellerSel, poMiddleSel, poMiddleSub, poBrandSel,
    deliveryStatusFilter, deliveryUpdates,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  const filtered = useMemo(() => {
    // 상태 필터 적용
    let result = statusFilter !== "all"
      ? baseFiltered.filter(o => o.status === statusFilter)
      : baseFiltered;

    // Sort
    result = [...result].sort((a, b) => {
      const m = sortDir === "desc" ? -1 : 1;
      if (sortBy === "date") return m * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return m * (a.finalAmount - b.finalAmount);
    });

    return result;
  }, [baseFiltered, statusFilter, sortBy, sortDir]);

  // 메인 주문 목록 페이지네이션 (페이지당 20건)
  const { pageItems, page, setPage, totalPages } = usePagination(filtered, 20);

  const totalAmount = filtered.reduce((s, o) => s + o.finalAmount, 0);
  
  // Period sales summary
  const periodSales = useMemo(() => {
    const paidStatuses = ["PAID", "CONFIRMED", "SHIPPING", "DELIVERED"];
    const paidOrders = orders.filter(o => paidStatuses.includes(o.status));
    const now = new Date();
    
    const calcTotal = (startDate: Date) =>
      paidOrders
        .filter(o => new Date(o.createdAt) >= startDate)
        .reduce((s, o) => s + o.finalAmount, 0);

    const totalAll = paidOrders.reduce((s, o) => s + o.finalAmount, 0);
    const week1 = calcTotal(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const month1 = calcTotal(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const month3 = calcTotal(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));

    return { totalAll, week1, month1, month3 };
  }, [orders]);

  // 상태별 건수: 상태 필터를 적용하기 전 집합(baseFiltered)에서 계산 →
  // 초기 로드부터 모든 카드에 실제 건수가 표시되고, 상태 카드 클릭과 무관하게 유지된다.
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    baseFiltered.forEach(o => { m[o.status] = (m[o.status] || 0) + 1; });
    return m;
  }, [baseFiltered]);

  const getTypeBadge = (order: Order) => {
    const t = classifyOrder(order);
    if (t === "groupbuy") return <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full border border-emerald-100">공동구매</span>;
    if (t === "live") return <span className="text-[9px] font-bold bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded-full border border-pink-100">라이브</span>;
    return <span className="text-[9px] font-bold bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">일반</span>;
  };

  const isCartType = (order: Order) => {
    return classifyOrder(order) === "groupbuy" || classifyOrder(order) === "live";
  };

  const detailOrder = showDetail ? orders.find(o => o.id === showDetail) : null;

  // 날짜별 주문서 일괄 출력 대상: 현재 필터(날짜·검색·셀러 등)가 적용된 목록 중 열람 권한이 있는 주문
  const sheetOrders = useMemo(() => filtered.filter(o => o.canViewDetail !== false), [filtered]);

  const rangeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom} ~ ${dateTo}`;
    if (dateFrom) return `${dateFrom} ~`;
    if (dateTo) return `~ ${dateTo}`;
    return "전체 기간";
  }, [dateFrom, dateTo]);

  const sheetHtml = useMemo(
    () => buildOrderSheetsHtml(sheetOrders, { rangeLabel }),
    [sheetOrders, rangeLabel]
  );

  /* ── 결제취소 요청 핸들러 (셀러) — 바닐라 플라워 확인 모달 표시 ── */
  const handleCancelRequest = async (order: Order) => {
    setCancelConfirmOrder(order);
  };

  /* ── 확인 후 실제 취소 API 호출 ── */
  const handleCancelRequestConfirmed = async (order: Order) => {
    setCancelConfirmOrder(null);
    setCancelRequesting(order.id);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel-request`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { appAlert(data.error || "결제취소 요청에 실패했습니다."); return; }
      const { cancelType, cancelStatus, cancelAmount, cancelFromSettlement } = data;
      setCancelUpdates(prev => ({
        ...prev,
        [order.id]: { cancelType, cancelStatus, cancelAmount: Number(cancelAmount), cancelFromSettlement: !!cancelFromSettlement },
      }));
      setCancelModalOrder(order);
      setCancelModalState({ cancelType, cancelStatus, cancelAmount: Number(cancelAmount) });
    } catch {
      appAlert("결제취소 요청 처리 중 오류가 발생했습니다.");
    } finally {
      setCancelRequesting(null);
    }
  };

  /* ── 결제취소 요청 철회 핸들러 (셀러) ── */
  const handleCancelWithdraw = async (order: Order) => {
    setCancelWithdrawing(order.id);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel-withdraw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { appAlert(data.error || "취소 요청 철회에 실패했습니다."); return; }
      setCancelUpdates(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch {
      appAlert("취소 요청 철회 처리 중 오류가 발생했습니다.");
    } finally {
      setCancelWithdrawing(null);
    }
  };

  /* ── 결제취소 승인 핸들러 (관리자) ── */
  const handleCancelApprove = async (order: Order) => {
    const confirmed = window.confirm(`결제취소를 승인하시겠습니까?\n\n주문번호: ${order.orderNumber}\n금액: ${formatPrice(order.finalAmount)}\n\n승인 시 즉시 취소 처리됩니다.`);
    if (!confirmed) return;
    setCancelApproving(order.id);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel-approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { appAlert(data.error || "결제취소 승인에 실패했습니다."); return; }
      setCancelUpdates(prev => ({
        ...prev,
        [order.id]: { ...(prev[order.id] || { cancelType: "", cancelAmount: 0, cancelFromSettlement: false }), cancelStatus: "COMPLETED" },
      }));
      appAlert("결제취소가 완료되었습니다. 목록을 새로고침합니다.");
      window.location.reload();
    } catch {
      appAlert("결제취소 승인 처리 중 오류가 발생했습니다.");
    } finally {
      setCancelApproving(null);
    }
  };

  const handlePrintSheets = () => {
    if (sheetOrders.length === 0) {
      appAlert("선택한 기간에 출력할 주문서가 없습니다.");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) {
      appAlert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }
    w.document.write(buildOrderSheetsHtml(sheetOrders, { rangeLabel, autoPrint: true }));
    w.document.close();
  };

  const handleOpenBulkSheet = () => {
    if (sheetOrders.length === 0) {
      appAlert("선택한 기간에 출력할 주문서가 없습니다.");
      return;
    }
    setShowBulkSheet(true);
  };

  // 주문서 엑셀(xlsx) 다운로드 — 현재 기간·필터의 주문을 상품 단위 행으로 내보낸다.
  const handleExportExcel = async () => {
    if (sheetOrders.length === 0) {
      appAlert("내보낼 주문이 없습니다.");
      return;
    }
    const XLSX = await import("xlsx");
    const rows: Record<string, any>[] = [];
    for (const o of sheetOrders) {
      const items = o.items.length > 0 ? o.items : [{ productName: "", variantName: "", quantity: 0, totalPrice: 0 } as any];
      for (const it of items) {
        rows.push({
          "주문번호": o.orderNumber,
          "주문일": formatDate(o.paidAt || o.createdAt),
          "상품명": it.productName,
          "옵션": it.variantName || "",
          "수량": it.quantity,
          "상품금액": it.totalPrice,
          "주문금액(합계)": o.finalAmount,
          "고객명": o.userName,
          "수령인": o.shippingName || "",
          "연락처": o.shippingPhone || "",
          "주소": o.shippingAddress || "",
          "배송메모": o.shippingMemo || "",
          "라이브 셀러": o.sellerName,
          "브랜드": o.brandName || "",
          "상태": STATUS_LABEL[o.status] || o.status,
          "결제수단": paymentMethodLabel(o.paymentMethod),
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 6 }, { wch: 12 },
      { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "주문서");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `주문서_${stamp}.xlsx`);
  };

  const handleKakaoShare = (order: Order) => {
    const orderUrl = typeof window !== "undefined" ? `${window.location.origin}/my/orders?id=${order.id}` : "";
    const msg = `📦 주문 안내\n\n주문번호: ${order.orderNumber}\n상품: ${order.items.map(i => i.productName).join(", ")}\n금액: ${formatPrice(order.finalAmount)}\n\n주문 페이지: ${orderUrl}`;
    if (navigator.share) {
      navigator.share({ title: "주문 안내", text: msg, url: orderUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg);
      appAlert("주문 정보가 클립보드에 복사되었습니다!\n카카오톡에 붙여넣기 하세요.");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-xs sm:text-sm text-gray-500">총 {filtered.length}건 · {formatPrice(totalAmount)}</p>
        </div>
      </div>

      {/* ★ Sales Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-xl p-3 text-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Chart" size={13} />
            <span className="text-[10px] font-medium opacity-80">총 매출</span>
          </div>
          <p className="text-base sm:text-lg font-extrabold">{formatPrice(periodSales.totalAll)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Calendar" size={12} className="text-blue-500" />
            <span className="text-[10px] text-gray-400">최근 1주</span>
          </div>
          <p className="text-sm sm:text-base font-bold text-gray-900">{formatPrice(periodSales.week1)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Calendar" size={12} className="text-green-500" />
            <span className="text-[10px] text-gray-400">최근 1개월</span>
          </div>
          <p className="text-sm sm:text-base font-bold text-gray-900">{formatPrice(periodSales.month1)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Icon name="Calendar" size={12} className="text-purple-500" />
            <span className="text-[10px] text-gray-400">최근 3개월</span>
          </div>
          <p className="text-sm sm:text-base font-bold text-gray-900">{formatPrice(periodSales.month3)}</p>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { status: "PENDING", label: "결제대기" },
          { status: "PAID", label: "결제완료" },
          { status: "SHIPPING", label: "배송중" },
          { status: "DELIVERED", label: "배송완료" },
        ].map(s => (
          <button
            key={s.status}
            onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}
            className={`p-2.5 rounded-xl border text-center transition-all ${
              statusFilter === s.status
                ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
                : "border-gray-100 bg-white hover:border-gray-200"
            }`}
          >
            <p className="text-lg font-bold text-gray-900">{statusCounts[s.status] || 0}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="주문번호, 구매자, 라이브 셀러, 상품명 검색..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Range — 캘린더 아이콘 바닐라 플라워 테마 (네이티브 아이콘은 투명 처리, 클릭 시 DatePicker 그대로 열림) */}
        <div className="flex items-center gap-1">
          <BeeDateInput value={pendingDateFrom} onChange={setPendingDateFrom} ariaLabel="시작일" />
          <span className="text-xs text-gray-400">~</span>
          <BeeDateInput value={pendingDateTo} onChange={setPendingDateTo} ariaLabel="종료일" />
          <button
            onClick={() => { setDateFrom(pendingDateFrom); setDateTo(pendingDateTo); }}
            className="ml-1 flex items-center gap-1 text-xs font-bold border border-amber-300 rounded-xl px-3 py-2 bg-amber-400 hover:bg-amber-500 text-white whitespace-nowrap"
          >
            적용
          </button>
        </div>

        {/* 날짜별 주문서 모아 보기/다운로드 */}
        <button
          onClick={handleOpenBulkSheet}
          className="flex items-center gap-1 text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white hover:bg-gray-50 text-gray-700"
          title="현재 기간·필터의 주문서를 한 번에 모아 보기"
        >
          <Icon name="Eye" size={13} /> 주문서 모아 보기
        </button>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1 text-xs font-bold border border-emerald-200 rounded-xl px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          title="현재 기간·필터의 주문서를 엑셀(xlsx)로 다운로드"
        >
          <Icon name="Download" size={13} /> 엑셀 다운로드
        </button>
        <button
          onClick={handlePrintSheets}
          className="flex items-center gap-1 text-xs font-bold border border-brand-200 rounded-xl px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white"
          title="현재 기간·필터의 주문서를 인쇄하거나 PDF로 저장"
        >
          <Printer size={13} /> 주문서 출력 ({sheetOrders.length})
        </button>

        {/* Seller filter (admin/brand) */}
        {(role === "SUPER_ADMIN" || role === "BRAND_ADMIN") && sellers.length > 0 && (
          <select
            value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체 라이브 셀러</option>
            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        {/* Brand filter (admin only) */}
        {role === "SUPER_ADMIN" && brands.length > 0 && (
          <select
            value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체 브랜드</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Sort */}
        <button
          onClick={() => {
            if (sortBy === "date") {
              if (sortDir === "desc") setSortDir("asc");
              else { setSortBy("amount"); setSortDir("desc"); }
            } else {
              if (sortDir === "desc") setSortDir("asc");
              else { setSortBy("date"); setSortDir("desc"); }
            }
          }}
          className="flex items-center gap-1 text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white hover:bg-gray-50 text-gray-600"
        >
          <ArrowUpDown size={12} />
          {sortBy === "date" ? "날짜" : "금액"} {sortDir === "desc" ? "↓" : "↑"}
        </button>
      </div>

      {/* 발주서 구분 필터 (중간관리자) */}
      {poFilter === "middle" && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            발주서 구분
          </span>
          <select
            value={poScope}
            onChange={e => { setPoScope(e.target.value as any); setPoScopeBrand("all"); }}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체</option>
            <option value="mine">내가 등록한 상품</option>
            <option value="brand">하위 브랜드별</option>
          </select>
          {poScope === "brand" && (
            <select
              value={poScopeBrand}
              onChange={e => setPoScopeBrand(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">전체 하위 브랜드</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1 ml-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            배송상태
          </span>
          <select
            value={deliveryStatusFilter}
            onChange={e => setDeliveryStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체</option>
            <option value="PAYMENT_COMPLETED">결제완료</option>
            <option value="PREPARING">배송준비중</option>
            <option value="DELIVERING">배송중</option>
            <option value="DELIVERED">배송완료</option>
            <option value="CANCEL_REQUESTED">취소요청중</option>
            <option value="CANCEL_COMPLETED">취소완료</option>
          </select>
        </div>
      )}

      {/* 발주서 구분 필터 (최고관리자) */}
      {poFilter === "admin" && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            발주서 구분
          </span>
          <select
            value={poType}
            onChange={e => {
              setPoType(e.target.value as any);
              setPoSellerSel("all"); setPoMiddleSel("all"); setPoMiddleSub("all"); setPoBrandSel("all");
            }}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체</option>
            <option value="seller">셀러별</option>
            <option value="middle">중간관리자별</option>
            <option value="brand">브랜드별</option>
            <option value="package">패키지 상품</option>
          </select>

          {poType === "seller" && (
            <select
              value={poSellerSel}
              onChange={e => setPoSellerSel(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="all">셀러 선택</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          {poType === "middle" && (
            <>
              <select
                value={poMiddleSel}
                onChange={e => { setPoMiddleSel(e.target.value); setPoMiddleSub("all"); }}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="all">중간관리자 선택</option>
                {middleAdmins.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {poMiddleSel !== "all" && (
                <select
                  value={poMiddleSub}
                  onChange={e => setPoMiddleSub(e.target.value as any)}
                  className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="all">전체</option>
                  <option value="own">본인 등록 상품</option>
                  <option value="subbrand">하위 브랜드 상품</option>
                </select>
              )}
            </>
          )}

          {poType === "brand" && (
            <>
              <select
                value={poBrandSel}
                onChange={e => setPoBrandSel(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="all">브랜드 선택</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {poBrandSel !== "all" && brandManagerMap[poBrandSel] && (
                <span className="text-[11px] font-medium text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1">
                  <Building2 size={12} /> 관리 중간관리자: {brandManagerMap[poBrandSel]}
                </span>
              )}
            </>
          )}
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1 ml-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            배송상태
          </span>
          <select
            value={deliveryStatusFilter}
            onChange={e => setDeliveryStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체</option>
            <option value="PAYMENT_COMPLETED">결제완료</option>
            <option value="PREPARING">배송준비중</option>
            <option value="DELIVERING">배송중</option>
            <option value="DELIVERED">배송완료</option>
            <option value="CANCEL_REQUESTED">취소요청중</option>
            <option value="CANCEL_COMPLETED">취소완료</option>
          </select>
        </div>
      )}

      {/* 배송상태 필터 (발주서 구분이 없는 역할 — SELLER, BRAND_ADMIN, NODE 등) */}
      {!poFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            배송상태
          </span>
          <select
            value={deliveryStatusFilter}
            onChange={e => setDeliveryStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="all">전체</option>
            <option value="PAYMENT_COMPLETED">결제완료</option>
            <option value="PREPARING">배송준비중</option>
            <option value="DELIVERING">배송중</option>
            <option value="DELIVERED">배송완료</option>
            <option value="CANCEL_REQUESTED">취소요청중</option>
            <option value="CANCEL_COMPLETED">취소완료</option>
          </select>
        </div>
      )}

      {/* Orders List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Icon name="File" size={48} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{searchQuery ? "검색 결과가 없습니다." : "주문이 없습니다."}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pageItems.map(order => {
            const status = STATUS_MAP[order.status] || { label: order.status, color: "bg-gray-100 text-gray-600", icon: Clock };
            const isExpanded = expandedOrder === order.id;
            const StatusIcon = status.icon;
            const cartType = isCartType(order);

            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow">
                {/* Order Header */}
                <div
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  {/* 썸네일 */}
                  <div className="w-14 h-14 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {order.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={order.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="Package" size={20} className="text-gray-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* 주문번호(작게) + 배지 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-mono tracking-tight">{order.orderNumber}</span>
                      {getTypeBadge(order)}
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                      {cartType && order.status === "PENDING" && (
                        <span className="text-[8px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-0.5">
                          <Icon name="Cart" size={8} /> 장바구니
                        </span>
                      )}
                      {(() => {
                        const ds = deliveryUpdates[order.id]?.deliveryStatus ?? order.deliveryStatus;
                        if (!ds) return null;
                        const d = DELIVERY_STATUS_MAP[ds];
                        if (!d) return null;
                        return (
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${d.color}`}>
                            <Icon name="Truck" size={8} className="inline mr-0.5" />{d.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const cs = cancelUpdates[order.id]?.cancelStatus ?? order.cancelStatus;
                        if (!cs) return null;
                        const cf = cancelUpdates[order.id]?.cancelFromSettlement ?? order.cancelFromSettlement;
                        const key = getCancelBadgeKey(cs, cf);
                        if (!key) return null;
                        const badge = CANCEL_STATUS_MAP[key];
                        if (!badge) return null;
                        return (
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            <Ban size={8} className="inline mr-0.5" />{badge.label}
                          </span>
                        );
                      })()}
                    </div>
                    {/* 상품명(가장 크게 강조) */}
                    <p className="text-sm sm:text-[15px] font-bold text-gray-900 truncate mt-0.5">
                      {order.items[0]?.productName || "주문 상품"}
                      {order.items.length > 1 && <span className="text-xs font-normal text-gray-400"> 외 {order.items.length - 1}건</span>}
                    </p>
                    {/* 주문자(고객명) 강조 */}
                    <p className="text-[13px] font-semibold text-gray-700 truncate">
                      {order.userName}
                      {(role === "SUPER_ADMIN" || role === "BRAND_ADMIN") && (
                        <span className="text-xs font-medium text-brand-500"> → {order.sellerName}</span>
                      )}
                      {order.brandName && role === "SUPER_ADMIN" && (
                        <span className="text-[11px] font-medium text-purple-500"> · {order.brandName}</span>
                      )}
                    </p>
                    {/* 주문 회원(배송지) 연락처 — 목록에서 바로 확인 */}
                    {order.shippingPhone && (
                      <a
                        href={`tel:${order.shippingPhone}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500 hover:text-brand-600 mt-0.5"
                      >
                        <Phone size={10} /> {order.shippingPhone}
                      </a>
                    )}
                    {/* 결제일(부각) + 결제수단 */}
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-0.5 font-semibold text-gray-700">
                        <Icon name="Calendar" size={10} /> {formatDate(order.paidAt || order.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <Icon name="CreditCard" size={10} /> {paymentMethodLabel(order.paymentMethod)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-extrabold text-gray-900">{formatPrice(order.finalAmount)}</p>
                    <p className="text-[10px] text-gray-400">{order.items.length}개 상품</p>
                  </div>
                  <Icon name="ChevronDown" size={16} className={`text-gray-300 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-50">
                    {/* Items */}
                    <div className="px-3 sm:px-4 py-3">
                      {order.campaignTitle && (
                        <p className="text-[10px] text-emerald-600 font-bold mb-2 flex items-center gap-1">
                          <Icon name="Cart" size={10} /> 캠페인: {order.campaignTitle}
                        </p>
                      )}
                      {order.discountType === "live" && (
                        <p className="text-[10px] text-pink-600 font-bold mb-2 flex items-center gap-1">
                          <Icon name="Live" size={10} /> 라이브 커머스 주문
                        </p>
                      )}
                      <div className="space-y-1.5">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between py-1">
                            <span className="text-xs text-gray-700">
                              {item.productName}
                              {item.variantName && (
                                <span className="ml-1.5 inline-flex items-center text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                                  옵션 {item.variantName}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-600 flex-shrink-0 ml-2">{item.quantity}개 · {formatPrice(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-50 text-xs">
                        <span className="text-gray-400">합계</span>
                        <span className="font-bold">{formatPrice(order.finalAmount)}</span>
                      </div>
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">할인</span>
                          <span className="text-red-500">-{formatPrice(order.discountAmount)}</span>
                        </div>
                      )}
                      {order.feeInfo && (
                        <div className="mt-3">
                          <OrderFeeSection fee={order.feeInfo} />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-3 sm:px-4 py-2.5 bg-gray-50/50 border-t border-gray-50 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={e => { e.stopPropagation(); setPoOrderId(order.id); }}
                        className="text-[11px] px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1 font-medium"
                      >
                        <Icon name="File" size={12} /> 발주서
                      </button>
                      {order.canViewDetail && (
                        <button
                          onClick={e => { e.stopPropagation(); setShowDetail(order.id); }}
                          className="text-[11px] px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-1 font-medium"
                        >
                          <Icon name="Eye" size={12} /> 상세보기
                        </button>
                      )}
                      {canManageDelivery && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeliveryOrderId(order.id); }}
                          className="text-[11px] px-3 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-lg hover:bg-cyan-100 flex items-center gap-1 font-medium"
                        >
                          <Icon name="Truck" size={12} /> 배송 처리
                        </button>
                      )}
                      {cartType && (
                        <button
                          onClick={e => { e.stopPropagation(); handleKakaoShare(order); }}
                          className="text-[11px] px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center gap-1 font-medium"
                        >
                          💬 카카오톡 전달
                        </button>
                      )}
                      {/* ── 셀러: 결제취소요청 버튼 ── */}
                      {role === "SELLER" && (() => {
                        const cs = cancelUpdates[order.id]?.cancelStatus ?? order.cancelStatus;
                        const payStatus = order.paymentStatus;
                        if (payStatus === "COMPLETED" && !cs) {
                          return (
                            <button
                              onClick={e => { e.stopPropagation(); handleCancelRequest(order); }}
                              disabled={cancelRequesting === order.id}
                              className="text-[11px] px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1 font-medium disabled:opacity-50"
                            >
                              {cancelRequesting === order.id ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                              결제취소요청
                            </button>
                          );
                        }
                        // 이미 취소 요청이 있으면 확인 버튼 + REQUESTED 상태면 철회 버튼도 표시
                        if (cs && cs !== "COMPLETED") {
                          return (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setCancelModalOrder(order); setCancelModalState({ cancelType: (cancelUpdates[order.id]?.cancelType ?? order.cancelType ?? "POST_DAY") as "SAME_DAY" | "POST_DAY", cancelStatus: cs, cancelAmount: cancelUpdates[order.id]?.cancelAmount ?? Number(order.cancelAmount ?? 0) }); }}
                                className="text-[11px] px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg hover:bg-amber-100 flex items-center gap-1 font-medium"
                              >
                                <Ban size={11} /> 취소요청 확인
                              </button>
                              {cs === "REQUESTED" && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleCancelWithdraw(order); }}
                                  disabled={cancelWithdrawing === order.id}
                                  className="text-[11px] px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1 font-medium disabled:opacity-50"
                                >
                                  {cancelWithdrawing === order.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                  취소요청 철회
                                </button>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}
                      {/* ── 최고관리자: 결제취소 승인 버튼 ── */}
                      {role === "SUPER_ADMIN" && (() => {
                        const cs = cancelUpdates[order.id]?.cancelStatus ?? order.cancelStatus;
                        if (cs === "REQUESTED" || cs === "DEPOSIT_CONFIRMED") {
                          return (
                            <button
                              onClick={e => { e.stopPropagation(); handleCancelApprove(order); }}
                              disabled={cancelApproving === order.id}
                              className="text-[11px] px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1 font-medium disabled:opacity-50"
                            >
                              {cancelApproving === order.id ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                              결제취소 승인
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {/* ★ Order Detail Modal */}
      {detailOrder && detailOrder.canViewDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">주문 상세</h3>
              <button onClick={() => setShowDetail(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Icon name="File" size={12} /> 주문 정보</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">주문번호</span>
                  <span className="font-bold text-gray-900">{detailOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">주문일시</span>
                  <span className="text-gray-700">{formatDateTime(detailOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">결제수단</span>
                  <span className="text-gray-700">{paymentMethodLabel(detailOrder.paymentMethod)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">상태</span>
                  <span className={`font-medium px-2 py-0.5 rounded-full text-[10px] ${STATUS_MAP[detailOrder.status]?.color || ""}`}>
                    {STATUS_MAP[detailOrder.status]?.label || detailOrder.status}
                  </span>
                </div>
                {detailOrder.paidAt && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">결제일시</span>
                    <span className="text-gray-700">{formatDateTime(detailOrder.paidAt)}</span>
                  </div>
                )}
                {detailOrder.shippedAt && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">배송시작</span>
                    <span className="text-gray-700">{formatDateTime(detailOrder.shippedAt)}</span>
                  </div>
                )}
                {detailOrder.deliveredAt && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">배송완료</span>
                    <span className="text-gray-700">{formatDateTime(detailOrder.deliveredAt)}</span>
                  </div>
                )}
              </div>

              {/* Buyer Info */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">👤 구매자 정보</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">이름</span>
                  <span className="text-gray-700">{detailOrder.userName}</span>
                </div>
                {detailOrder.userEmail && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">이메일</span>
                    <span className="text-gray-700">{detailOrder.userEmail}</span>
                  </div>
                )}
              </div>

              {/* Shipping Info */}
              {detailOrder.shippingName && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1"><Icon name="Truck" size={12} /> 배송 정보</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">수령인</span>
                    <span className="text-gray-700">{detailOrder.shippingName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">연락처</span>
                    <span className="text-gray-700">{detailOrder.shippingPhone}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">주소</span>
                    <span className="text-gray-700 text-right max-w-[200px]">{detailOrder.shippingAddress}</span>
                  </div>
                  {detailOrder.shippingMemo && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">배송메모</span>
                      <span className="text-gray-700">{detailOrder.shippingMemo}</span>
                    </div>
                  )}
                  {detailOrder.snsAccounts && detailOrder.snsAccounts.length > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">SNS 계정</span>
                      <span className="text-gray-700 text-right max-w-[200px]">
                        {detailOrder.snsAccounts.map((s) => `${s.platform}: ${s.handle}`).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><Icon name="Package" size={12} /> 주문 상품</p>
                <div className="bg-gray-50 rounded-xl overflow-hidden">
                  {detailOrder.items.map(item => (
                    <div key={item.id} className="flex justify-between p-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-md bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="Package" size={14} className="text-gray-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              <span className="font-semibold text-brand-600">옵션</span> · {item.variantName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-xs text-gray-700">{formatPrice(item.price)} x {item.quantity}</p>
                        <p className="text-xs font-bold">{formatPrice(item.totalPrice)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-brand-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">상품 합계</span>
                  <span>{formatPrice(detailOrder.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">배송비</span>
                  <span>{formatPrice(detailOrder.shippingFee)}</span>
                </div>
                {detailOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">할인</span>
                    <span className="text-red-500">-{formatPrice(detailOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-brand-100">
                  <span className="text-sm font-bold text-gray-900">최종 결제금액</span>
                  <span className="text-sm font-extrabold text-brand-600">{formatPrice(detailOrder.finalAmount)}</span>
                </div>
              </div>

              {/* 정산 수수료 안내 */}
              {detailOrder.feeInfo && <OrderFeeSection fee={detailOrder.feeInfo} />}
            </div>
            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowDetail(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ★ 날짜별 주문서 일괄 미리보기 모달 */}
      {showBulkSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowBulkSheet(false)}>
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Icon name="File" size={16} /> 주문서 모아 보기
                </h3>
                <p className="text-[11px] text-gray-400">{rangeLabel} · 총 {sheetOrders.length}건</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSheets}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
                >
                  <Printer size={13} /> 인쇄 / PDF 저장
                </button>
                <button onClick={() => setShowBulkSheet(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-gray-100 rounded-b-2xl">
              <iframe title="주문서 모아 보기" srcDoc={sheetHtml} className="w-full h-[70vh] border-0" />
            </div>
          </div>
        </div>
      )}

      {/* ★ 발주서 개별 확인 모달 */}
      {poOrderId && (
        <PurchaseOrderModal orderId={poOrderId} role={role} onClose={() => setPoOrderId(null)} />
      )}

      {/* ★ 배송 처리 모달 */}
      {deliveryOrderId && (() => {
        const o = orders.find(x => x.id === deliveryOrderId);
        if (!o) return null;
        const cached = deliveryUpdates[deliveryOrderId];
        return (
          <DeliveryModal
            orderId={deliveryOrderId}
            current={{
              status: cached?.deliveryStatus ?? o.deliveryStatus ?? "PAYMENT_COMPLETED",
              courier: cached?.deliveryCourier ?? o.deliveryCourier,
              tracking: cached?.deliveryTracking ?? o.deliveryTracking,
            }}
            onClose={() => setDeliveryOrderId(null)}
            onSaved={updated => setDeliveryUpdates(prev => ({ ...prev, [deliveryOrderId]: updated }))}
          />
        );
      })()}

      {/* ★ 결제취소 요청 전 바닐라 플라워 확인 모달 */}
      {cancelConfirmOrder && (
        <CancelConfirmModal
          order={cancelConfirmOrder}
          onConfirm={() => handleCancelRequestConfirmed(cancelConfirmOrder)}
          onClose={() => setCancelConfirmOrder(null)}
        />
      )}

      {/* ★ 결제취소 요청 모달 */}
      {cancelModalOrder && cancelModalState && (
        <CancelRequestModal
          orderId={cancelModalOrder.id}
          cancelAmount={cancelModalState.cancelAmount}
          cancelType={cancelModalState.cancelType}
          cancelStatus={cancelUpdates[cancelModalOrder.id]?.cancelStatus ?? cancelModalState.cancelStatus}
          onClose={() => { setCancelModalOrder(null); setCancelModalState(null); }}
          onDepositConfirmed={() => {
            if (!cancelModalOrder) return;
            setCancelUpdates(prev => ({
              ...prev,
              [cancelModalOrder.id]: { ...prev[cancelModalOrder.id], cancelStatus: "DEPOSIT_CONFIRMED" },
            }));
          }}
        />
      )}
    </>
  );
}
