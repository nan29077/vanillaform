"use client";

import { Icon } from '@/components/shared/Icon';
import { useEffect, useMemo, useState } from "react";
import {Sparkles, Printer, Loader2, X, User as UserIcon, Phone, MapPin, Tag, Landmark, List, Youtube, Instagram, AtSign, Package, Trash2} from 'lucide-react';
import OrderManagementClient from "@/components/shared/OrderManagementClient";
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

// 바닐라 플라워 테마 캘린더 아이콘 — lucide 컴포넌트 자리(DetailRow icon)에 그대로 사용 가능
const BeeCalendarIcon = ({ size = 12 }: { size?: number }) => <Icon name="Calendar" size={size} />;

interface CartItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  price?: number;
  thumbnail?: string | null;
  createdAt: string;
}

// 장바구니/소셜주문서 탭 공용 상품 상세 미니 모달
interface MiniProduct {
  productName: string;
  variantName?: string | null;
  price?: number | null;
  quantity?: number | null;
  thumbnail?: string | null;
}

function ProductMiniModal({ product, onClose }: { product: MiniProduct; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[360px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Icon name="Package" size={16} className="text-amber-500" />
            <h2 className="text-[15px] font-bold text-gray-900">상품 상세</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {product.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name="Package" size={26} className="text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-[14px] font-bold text-gray-900 break-words">{product.productName}</p>
              {product.variantName && (
                <p className="text-[12px] text-gray-500">옵션 · {product.variantName}</p>
              )}
              {product.price != null && product.price > 0 && (
                <p className="text-[13px] font-semibold text-amber-700">{won(product.price)}</p>
              )}
              {product.quantity != null && (
                <p className="text-[12px] text-gray-500">수량 {product.quantity}개</p>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  orders: any[];
  sellerId: string;
  sellerName: string;
  cartItems: CartItem[];
}

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString("ko-KR", {
    year: "2-digit", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

export default function SellerOrdersTabs({ orders, sellerId, sellerName, cartItems }: Props) {
  const [tab, setTab] = useState<"orders" | "cart" | "social">("orders");

  // 장바구니 (삭제 시 목록·탭 건수 반영 위해 로컬 상태로 관리)
  const [cartList, setCartList] = useState<CartItem[]>(cartItems);
  useEffect(() => setCartList(cartItems), [cartItems]);

  // 소셜주문서 (탭 건수 표시 위해 부모에서 조회)
  const [socialOrders, setSocialOrders] = useState<SocialOrder[]>([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialErr, setSocialErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/social-orders?sellerId=${encodeURIComponent(sellerId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "조회에 실패했습니다.");
        if (alive) setSocialOrders(data.orders || []);
      } catch (e: any) {
        if (alive) setSocialErr(e.message || "조회에 실패했습니다.");
      } finally {
        if (alive) setSocialLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerId]);

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex items-center gap-1 mb-5 bg-amber-50/60 p-1 rounded-xl w-full sm:w-fit border border-amber-100">
        <button
          onClick={() => setTab("orders")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${
            tab === "orders" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-amber-600"
          }`}
        >
          <Icon name="File" size={15} /> 주문관리
          <span className="ml-0.5 text-[11px] font-semibold text-gray-400">{orders.length}</span>
        </button>
        <button
          onClick={() => setTab("cart")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${
            tab === "cart" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-amber-600"
          }`}
        >
          <Icon name="Cart" size={15} /> 장바구니
          <span className="ml-0.5 text-[11px] font-semibold text-gray-400">{cartList.length}</span>
        </button>
        <button
          onClick={() => setTab("social")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${
            tab === "social" ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-amber-600"
          }`}
        >
          <Icon name="SnsDm_icon" size={15} /> 계좌 입금 주문서
          <span className="ml-0.5 text-[11px] font-semibold text-gray-400">{socialLoading ? "…" : socialOrders.length}</span>
        </button>
      </div>

      {tab === "orders" ? (
        <OrderManagementClient
          orders={orders}
          role="SELLER"
          sellers={[{ id: sellerId, name: sellerName }]}
          brands={[]}
          canManageDelivery={true}
        />
      ) : tab === "cart" ? (
        <CartPanel
          cartItems={cartList}
          sellerName={sellerName}
          onDeleted={(ids) => setCartList((prev) => prev.filter((c) => !ids.includes(c.id)))}
        />
      ) : (
        <SocialOrderPanel
          orders={socialOrders}
          loading={socialLoading}
          err={socialErr}
          sellerName={sellerName}
          onDeleted={(ids) => setSocialOrders((prev) => prev.filter((o) => !ids.includes(o.id)))}
        />
      )}
    </div>
  );
}

/* ───────────────── 소셜주문서 패널 ───────────────── */
interface SnsAccount {
  platform: string;
  handle: string;
}
interface SocialOrder {
  id: string;
  productId: string;
  productName: string;
  price: number;
  name: string;
  depositorName?: string;
  address: string;
  phone: string;
  snsAccounts: SnsAccount[];
  snsPlatform?: string | null;
  snsHandle?: string | null;
  snsNickname?: string | null;
  status?: string | null;
  quantity?: number | null;
  createdAt: string;
}

const won = (n: number) => (Number(n) || 0).toLocaleString("ko-KR") + "원";

function formatSns(accounts: SnsAccount[]): string {
  if (!accounts || accounts.length === 0) return "-";
  return accounts.map((a) => `${a.platform}: ${a.handle}`).join(" / ");
}

// SNS 플랫폼 라인형 아이콘 (유튜브 / 인스타 / 기타)
function snsIcon(platform: string) {
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube") || p.includes("유튜브")) return Youtube;
  if (p.includes("insta") || p.includes("인스타")) return Instagram;
  return AtSign;
}

function SocialOrderPanel({
  orders,
  loading,
  err,
  sellerName,
  onDeleted,
}: {
  orders: SocialOrder[];
  loading: boolean;
  err: string | null;
  sellerName: string;
  onDeleted: (ids: string[]) => void;
}) {
  const { appConfirm, appAlert } = useAppDialog();
  const [detail, setDetail] = useState<SocialOrder | null>(null);
  const [miniProduct, setMiniProduct] = useState<MiniProduct | null>(null);
  const [showCollect, setShowCollect] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  // 선택 삭제
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // 공통 삭제 실행 (선택/개별 공용)
  const performDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/social-orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert(data.error || "삭제에 실패했습니다.");
        return;
      }
      onDeleted(ids);
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      showToast(`${data.count ?? ids.length}건이 삭제되었습니다.`);
    } catch {
      await appAlert("삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (deleting) return;
    if (selected.size === 0) {
      showToast("삭제할 계좌 입금 주문서를 선택해주세요.");
      return;
    }
    const ids = Array.from(selected);
    const ok = await appConfirm({
      title: "정말로 삭제하시겠습니까?",
      message: `선택한 계좌 입금 주문서 ${ids.length}건을 삭제합니다.\n삭제된 주문서는 복구할 수 없어요.`,
      type: "confirm",
      confirmText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;
    await performDelete(ids);
  };

  const handleDeleteOne = async (order: SocialOrder) => {
    if (deleting) return;
    const ok = await appConfirm({
      title: "정말로 삭제하시겠습니까?",
      message: `'${order.name}' 님의 계좌 입금 주문서를 삭제합니다.\n삭제된 주문서는 복구할 수 없어요.`,
      type: "confirm",
      confirmText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;
    await performDelete([order.id]);
  };

  const handleConfirmPayment = async (orderId: string) => {
    if (confirming) return;
    setConfirming(orderId);
    try {
      const res = await fetch(`/api/social-orders/${encodeURIComponent(orderId)}/confirm-payment`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "입금 확인에 실패했습니다."); return; }
      setConfirmedIds(prev => new Set([...prev, orderId]));
    } catch {
      alert("입금 확인 처리 중 오류가 발생했습니다.");
    } finally {
      setConfirming(null);
    }
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = orders.map((o, i) => ({
      번호: orders.length - i,
      제출일: formatDateTime(o.createdAt),
      상품명: o.productName,
      가격: o.price,
      구매자명: o.name,
      입금자명: o.depositorName || o.name,
      연락처: o.phone,
      배송지: o.address,
      "SNS 계정": formatSns(o.snsAccounts),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 6 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "계좌 입금 주문서");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `계좌입금주문서_${sellerName}_${today}.xlsx`);
  };

  // PDF 출력: 각 소셜주문서를 한 장(page-break)으로 구성 → 브라우저 window.print()로 인쇄/PDF 저장
  const downloadPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildSocialSheetsHtml(orders, sellerName, true));
    w.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-semibold text-red-500">{err}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
          <Sparkles size={30} className="text-amber-300" />
        </div>
        <p className="text-sm font-semibold text-gray-500">접수된 계좌 입금 주문서가 없습니다</p>
        <p className="text-xs text-gray-400 mt-1">구매자가 상품 페이지에서 작성한 계좌 입금 주문서가 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div>
      {/* 소개 + 다운로드 */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex-1 min-w-[200px]">
          <Sparkles size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-amber-800">계좌 입금 주문서 {orders.length}건이 접수되었습니다.</p>
            <p className="text-[11px] text-amber-700/80 mt-0.5">엑셀 또는 PDF로 내려받아 발송·정리에 활용하세요.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCollect(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[12px] font-bold shadow-sm transition-colors"
          >
            <List size={13} /> 주문서 모아보기
          </button>
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold shadow-sm transition-colors"
          >
            <Icon name="Download" size={13} /> 엑셀 다운로드
          </button>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold shadow-sm shadow-amber-200 transition-colors"
          >
            <Printer size={13} /> 주문서 출력
          </button>
        </div>
      </div>

      {/* 선택/삭제 컨트롤 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-amber-500"
          />
          전체 선택
          <span className="text-gray-400 font-normal">
            ({selected.size}/{orders.length}건)
          </span>
        </label>
        <button
          onClick={handleDeleteSelected}
          disabled={deleting || selected.size === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 text-[12px] font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          선택 삭제
        </button>
      </div>

      {/* 테이블 (데스크탑) */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] text-gray-400 uppercase tracking-wide">
              <th className="w-10 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-amber-500 align-middle"
                />
              </th>
              <th className="w-12 py-3 text-center font-semibold">번호</th>
              <th className="text-left px-3 py-3 font-semibold">제출일</th>
              <th className="text-left px-3 py-3 font-semibold">상품명</th>
              <th className="text-right px-3 py-3 font-semibold">가격</th>
              <th className="text-left px-3 py-3 font-semibold">이름</th>
              <th className="text-left px-3 py-3 font-semibold">입금자명</th>
              <th className="text-left px-3 py-3 font-semibold">연락처</th>
              <th className="text-left px-3 py-3 font-semibold">배송지</th>
              <th className="text-left px-3 py-3 font-semibold">SNS 계정</th>
              <th className="w-28 text-center px-3 py-3 font-semibold">상태/처리</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id} className="border-t border-gray-50 hover:bg-amber-50/30">
                <td className="text-center px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(o.id)}
                    onChange={() => toggleOne(o.id)}
                    className="w-4 h-4 rounded accent-amber-500 align-middle"
                  />
                </td>
                <td className="text-center px-3 py-3 text-[13px] text-gray-500">{orders.length - i}</td>
                <td className="px-3 py-3 text-[12px] text-gray-500 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                <td className="px-3 py-3 text-[13px] text-gray-700">{o.productName}</td>
                <td className="px-3 py-3 text-[13px] text-right font-semibold text-gray-800 whitespace-nowrap">{won(o.price)}</td>
                <td className="px-3 py-3 text-[13px] font-semibold text-gray-800">{o.name}</td>
                <td className="px-3 py-3 text-[13px] text-gray-600 whitespace-nowrap">{o.depositorName || o.name}</td>
                <td className="px-3 py-3 text-[13px] text-gray-600 whitespace-nowrap">{o.phone}</td>
                <td className="px-3 py-3 text-[12px] text-gray-500 max-w-[220px]">{o.address}</td>
                <td className="px-3 py-3 text-[12px] text-gray-600">
                  {o.snsAccounts.length === 0 ? (
                    <span className="text-gray-300">-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {o.snsAccounts.map((a, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[11px] text-amber-700"
                        >
                          <span className="font-semibold">{a.platform}</span> {a.handle}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="text-center px-3 py-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setMiniProduct({ productName: o.productName, price: o.price })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 hover:bg-amber-50 border border-gray-200 text-gray-600 text-[11px] font-semibold whitespace-nowrap transition-colors"
                      >
                        <Icon name="Package" size={11} className="shrink-0" /> 상품
                      </button>
                      <button
                        onClick={() => setDetail(o)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 hover:bg-amber-50 border border-gray-200 text-gray-600 text-[11px] font-semibold whitespace-nowrap transition-colors"
                      >
                        <Icon name="Eye" size={11} className="shrink-0" /> 상세
                      </button>
                      <button
                        onClick={() => handleDeleteOne(o)}
                        disabled={deleting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={11} className="shrink-0" /> 삭제
                      </button>
                    </div>
                    {(confirmedIds.has(o.id) || o.status === "CONFIRMED") ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                        <Icon name="Check" size={11} /> 입금확인
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConfirmPayment(o.id)}
                        disabled={confirming === o.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[11px] font-bold whitespace-nowrap transition-colors disabled:opacity-50"
                      >
                        {confirming === o.id ? <Loader2 size={11} className="animate-spin" /> : <Icon name="Check" size={11} />}
                        입금 확인
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 카드 (모바일) */}
      <div className="md:hidden space-y-3">
        {orders.map((o, i) => (
          <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="flex items-center gap-2 cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggleOne(o.id)}
                  className="w-4 h-4 rounded accent-amber-500 shrink-0"
                />
                <p className="text-[13px] font-bold text-gray-800 truncate">
                  #{orders.length - i} · {o.name}
                </p>
              </label>
              <span className="text-[11px] text-gray-400 shrink-0">{formatDateTime(o.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[13px] text-gray-700">{o.productName}</p>
              <p className="text-[13px] font-bold text-amber-700 whitespace-nowrap">{won(o.price)}</p>
            </div>
            <p className="text-[12px] text-gray-500">💳 입금자명: {o.depositorName || o.name}</p>
            <p className="text-[12px] text-gray-500 mt-0.5">📞 {o.phone}</p>
            <p className="text-[12px] text-gray-500 mt-0.5">📍 {o.address}</p>
            {o.snsAccounts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {o.snsAccounts.map((a, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-[11px] text-amber-700"
                  >
                    <span className="font-semibold">{a.platform}</span> {a.handle}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => setMiniProduct({ productName: o.productName, price: o.price })}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-50 hover:bg-amber-50 border border-gray-200 text-gray-600 text-[12px] font-semibold transition-colors"
              >
                <Icon name="Package" size={13} /> 상품 상세
              </button>
              <button
                onClick={() => setDetail(o)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-50 hover:bg-amber-50 border border-gray-200 text-gray-600 text-[12px] font-semibold transition-colors"
              >
                <Icon name="Eye" size={13} /> 주문서 상세
              </button>
            </div>
            <div className="mt-2">
              {(confirmedIds.has(o.id) || o.status === "CONFIRMED") ? (
                <div className="flex items-center justify-center gap-1 w-full py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-semibold">
                  <Icon name="Check" size={13} /> 입금확인 완료
                </div>
              ) : (
                <button
                  onClick={() => handleConfirmPayment(o.id)}
                  disabled={confirming === o.id}
                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[12px] font-bold transition-colors disabled:opacity-50"
                >
                  {confirming === o.id ? <Loader2 size={13} className="animate-spin" /> : <Icon name="Check" size={13} />}
                  입금 확인
                </button>
              )}
            </div>
            <div className="mt-2">
              <button
                onClick={() => handleDeleteOne(o)}
                disabled={deleting}
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={13} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 상세 보기 모달 */}
      {detail && <SocialOrderDetailModal order={detail} onClose={() => setDetail(null)} />}

      {/* 상품 상세 미니 모달 */}
      {miniProduct && <ProductMiniModal product={miniProduct} onClose={() => setMiniProduct(null)} />}

      {/* 주문서 모아보기 모달 */}
      {showCollect && (
        <SheetCollectModal
          title="계좌 입금 주문서 모아보기"
          subtitle={`총 ${orders.length}건`}
          html={buildSocialSheetsHtml(orders, sellerName, false)}
          onPrint={downloadPDF}
          onClose={() => setShowCollect(false)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            <Icon name="Check" size={16} className="text-amber-400" />
            {toast}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes toast-slide-down {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-slide-down { animation: toast-slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}

/* ───────────────── 주문서 모아보기(미리보기) 공용 모달 ───────────────── */
function SheetCollectModal({
  title,
  subtitle,
  html,
  onPrint,
  onClose,
}: {
  title: string;
  subtitle: string;
  html: string;
  onPrint: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
              <List size={16} /> {title}
            </h3>
            <p className="text-[11px] text-gray-400">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="flex items-center gap-1 text-xs font-bold px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
            >
              <Printer size={13} /> 인쇄 / PDF 저장
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100 rounded-b-2xl">
          <iframe title={title} srcDoc={html} className="w-full h-[70vh] border-0" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── 소셜주문서 상세 모달 ───────────────── */
function SocialOrderDetailModal({ order, onClose }: { order: SocialOrder; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500" />
            <h2 className="text-[15px] font-bold text-gray-900">계좌 입금 주문서 상세</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          <DetailRow icon={Package} label="상품명" value={order.productName} />
          <DetailRow icon={Tag} label="가격" value={won(order.price)} />
          <DetailRow icon={UserIcon} label="이름" value={order.name} />
          <DetailRow icon={Landmark} label="입금자명" value={order.depositorName || order.name} />
          <DetailRow icon={Phone} label="연락처" value={order.phone} />
          <DetailRow icon={MapPin} label="배송지" value={order.address} />
          <DetailRow icon={BeeCalendarIcon} label="제출일" value={formatDateTime(order.createdAt)} />

          {/* SNS 계정 — 플랫폼 아이콘(라인형) + "플랫폼 아이디: 핸들" 형식 */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1">
              <Icon name="Share" size={12} /> SNS 계정
            </p>
            {order.snsAccounts.length === 0 ? (
              <p className="text-[13px] text-gray-300">-</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {order.snsAccounts.map((a, idx) => {
                  const Icon = snsIcon(a.platform);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 text-[12px] text-amber-700"
                    >
                      <Icon size={13} strokeWidth={1.75} className="shrink-0" />
                      <span className="font-semibold">{a.platform}</span> 아이디: {a.handle}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* 구매자 SNS 정보 — 구매 시 입력한 채널 아이디 / 대화명 (있을 때만) */}
          {(order.snsHandle || order.snsNickname) && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-amber-600 mb-2 flex items-center gap-1">
                <Icon name="Message" size={12} strokeWidth={1.75} /> 구매자 SNS 정보
              </p>
              <div className="space-y-2">
                {order.snsHandle && (
                  <div className="flex items-center gap-1.5 text-[13px] text-gray-800">
                    {(() => {
                      const Icon = snsIcon(order.snsPlatform || "");
                      return <Icon size={13} strokeWidth={1.75} className="shrink-0 text-amber-500" />;
                    })()}
                    <span className="text-[11px] font-semibold text-gray-400">
                      {order.snsPlatform || "채널"} 아이디
                    </span>
                    <span className="font-medium">{order.snsHandle}</span>
                  </div>
                )}
                {order.snsNickname && (
                  <div className="flex items-center gap-1.5 text-[13px] text-gray-800">
                    <Icon name="MyPage" size={13} strokeWidth={1.75} className="shrink-0 text-amber-500" />
                    <span className="text-[11px] font-semibold text-gray-400">대화명</span>
                    <span className="font-medium">{order.snsNickname}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 mb-0.5 flex items-center gap-1">
        <Icon size={12} /> {label}
      </p>
      <p className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{value}</p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHEET_STYLE = `
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
  @media print {
    body { background:#fff; padding:0; }
    .toolbar { display:none; }
    .sheet { box-shadow:none; border-radius:0; margin:0; max-width:none; padding: 16mm; }
    .page-break { page-break-after: always; }
  }`;

// 소셜주문서 일괄 출력/모아보기용 HTML (autoPrint=true 시 창 로드 후 자동 인쇄)
function buildSocialSheetsHtml(orders: SocialOrder[], sellerName: string, autoPrint: boolean): string {
  const today = new Date().toLocaleDateString("ko-KR");
  const sheets = orders
    .map((o, i) => {
      const snsRows =
        o.snsAccounts.length === 0
          ? ""
          : o.snsAccounts
              .map(
                (a) =>
                  `<tr><th>${escapeHtml(a.platform)}</th><td colspan="3">${escapeHtml(a.handle)}</td></tr>`
              )
              .join("");
      return `
      <section class="sheet${i < orders.length - 1 ? " page-break" : ""}">
        <div class="sheet-head">
          <h1>계좌 입금 주문서</h1>
          <div class="ono">No. ${orders.length - i}</div>
        </div>
        <table class="meta">
          <tr><th>제출일시</th><td>${escapeHtml(formatDateTime(o.createdAt))}</td><th>라이브 셀러</th><td>${escapeHtml(sellerName)}</td></tr>
          <tr><th>구매자명</th><td>${escapeHtml(o.name)}</td><th>연락처</th><td>${escapeHtml(o.phone)}</td></tr>
          <tr><th>입금자명</th><td colspan="3">${escapeHtml(o.depositorName || o.name)}</td></tr>
        </table>

        <h2>주문 상품</h2>
        <table class="items">
          <thead><tr><th>상품명</th><th style="width:140px">가격</th></tr></thead>
          <tbody>
            <tr><td>${escapeHtml(o.productName)}</td><td style="text-align:right">${won(o.price)}</td></tr>
          </tbody>
        </table>

        <h2>배송 정보</h2>
        <table class="meta">
          <tr><th>수령인</th><td>${escapeHtml(o.name)}</td><th>연락처</th><td>${escapeHtml(o.phone)}</td></tr>
          <tr><th>주소</th><td colspan="3">${escapeHtml(o.address) || "-"}</td></tr>
        </table>

        <h2>SNS 계정</h2>
        <table class="meta">
          ${snsRows || `<tr><td colspan="4" style="color:#9ca3af">등록된 SNS 계정이 없습니다.</td></tr>`}
        </table>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>계좌 입금 주문서 일괄 출력</title>
<style>${SHEET_STYLE}</style></head>
<body>
  <div class="toolbar">
    <span class="info">${escapeHtml(sellerName)} · 발행일 ${today} · 총 ${orders.length}건</span>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  ${sheets || '<div class="sheet"><p style="text-align:center;color:#9ca3af">출력할 계좌 입금 주문서가 없습니다.</p></div>'}
  ${autoPrint ? "<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>" : ""}
</body></html>`;
}

// 장바구니 일괄 출력/모아보기용 HTML — 구매자별 담은 상품 목록
function buildCartSheetsHtml(
  groups: { userName: string; userEmail: string; items: CartItem[] }[],
  sellerName: string,
  autoPrint: boolean
): string {
  const today = new Date().toLocaleDateString("ko-KR");
  const sheets = groups
    .map((g, i) => {
      const rows = g.items
        .map(
          (c) => `
        <tr>
          <td>${escapeHtml(c.productName)}</td>
          <td style="text-align:center">${escapeHtml(c.variantName || "") || "-"}</td>
          <td style="text-align:center">${c.quantity}</td>
          <td style="text-align:right">${c.price != null ? won(c.price) : "-"}</td>
          <td style="text-align:right">${escapeHtml(formatDateTime(c.createdAt))}</td>
        </tr>`
        )
        .join("");
      return `
      <section class="sheet${i < groups.length - 1 ? " page-break" : ""}">
        <div class="sheet-head">
          <h1>장바구니</h1>
          <div class="ono">No. ${i + 1}</div>
        </div>
        <table class="meta">
          <tr><th>구매자명</th><td>${escapeHtml(g.userName || "이름없음")}</td><th>이메일</th><td>${escapeHtml(g.userEmail)}</td></tr>
          <tr><th>라이브 셀러</th><td colspan="3">${escapeHtml(sellerName)}</td></tr>
        </table>

        <h2>담은 상품</h2>
        <table class="items">
          <thead><tr><th>상품명</th><th style="width:120px">옵션</th><th style="width:50px">수량</th><th style="width:100px">단가</th><th style="width:150px">담은 날짜</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>장바구니 일괄 출력</title>
<style>${SHEET_STYLE}</style></head>
<body>
  <div class="toolbar">
    <span class="info">${escapeHtml(sellerName)} · 발행일 ${today} · 총 ${groups.length}명</span>
    <button onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  ${sheets || '<div class="sheet"><p style="text-align:center;color:#9ca3af">출력할 장바구니 내역이 없습니다.</p></div>'}
  ${autoPrint ? "<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>" : ""}
</body></html>`;
}

/* ───────────────── 장바구니 패널 ───────────────── */
function CartPanel({
  cartItems,
  sellerName,
  onDeleted,
}: {
  cartItems: CartItem[];
  sellerName: string;
  onDeleted: (ids: string[]) => void;
}) {
  const { appConfirm, appAlert } = useAppDialog();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [miniProduct, setMiniProduct] = useState<MiniProduct | null>(null);
  const [showCollect, setShowCollect] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 구매자별 그룹핑 (구매자 최신 담은 순)
  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const c of cartItems) {
      if (!map.has(c.userId)) map.set(c.userId, []);
      map.get(c.userId)!.push(c);
    }
    return Array.from(map.entries()).map(([userId, items]) => ({
      userId,
      userName: items[0].userName,
      userEmail: items[0].userEmail,
      items,
    }));
  }, [cartItems]);

  // 구매자 그룹 페이지네이션 (페이지당 20명)
  const { pageItems: groupPageItems, page: groupPage, setPage: setGroupPage, totalPages: groupTotalPages } = usePagination(groups, 20);

  const allSelected = groups.length > 0 && selected.size === groups.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(groups.map((g) => g.userId)));
  };
  const toggleOne = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const sendOne = () => showToast("알림톡 발송 준비 중입니다.");
  const sendBulk = () => {
    if (selected.size === 0) return showToast("발송할 구매자를 선택해주세요.");
    showToast("알림톡 발송 준비 중입니다.");
  };

  // 공통 삭제 실행 (선택/개별 공용)
  const performDelete = async (ids: string[], deselectUserId?: string) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/seller/cart-items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        await appAlert(data.error || "삭제에 실패했습니다.");
        return;
      }
      onDeleted(ids);
      setSelected((prev) => {
        if (deselectUserId === undefined) return new Set();
        const next = new Set(prev);
        next.delete(deselectUserId);
        return next;
      });
      showToast(`${data.count ?? ids.length}건이 삭제되었습니다.`);
    } catch {
      await appAlert("삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (deleting) return;
    if (selected.size === 0) {
      showToast("삭제할 항목을 선택해주세요.");
      return;
    }
    // 선택된 구매자 그룹에 속한 모든 장바구니 항목 id 수집
    const ids = groups
      .filter((g) => selected.has(g.userId))
      .flatMap((g) => g.items.map((i) => i.id));
    const ok = await appConfirm({
      title: "정말로 삭제하시겠습니까?",
      message: `선택한 구매자 ${selected.size}명의 장바구니 상품 ${ids.length}건을 삭제합니다.\n삭제된 항목은 복구할 수 없어요.`,
      type: "confirm",
      confirmText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;
    await performDelete(ids);
  };

  const handleDeleteGroup = async (group: { userId: string; userName: string; items: CartItem[] }) => {
    if (deleting) return;
    const ids = group.items.map((i) => i.id);
    const ok = await appConfirm({
      title: "정말로 삭제하시겠습니까?",
      message: `'${group.userName || "이름없음"}' 님의 장바구니 상품 ${ids.length}건을 삭제합니다.\n삭제된 항목은 복구할 수 없어요.`,
      type: "confirm",
      confirmText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;
    await performDelete(ids, group.userId);
  };

  const downloadExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = cartItems.map((c) => ({
      구매자명: c.userName || "이름없음",
      이메일: c.userEmail,
      상품명: c.productName,
      옵션: c.variantName || "",
      수량: c.quantity,
      단가: c.price != null ? c.price : "",
      "담은 날짜": formatDateTime(c.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 6 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "장바구니");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `장바구니_${sellerName}_${today}.xlsx`);
  };

  const downloadPDF = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildCartSheetsHtml(groups, sellerName, true));
    w.document.close();
  };

  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
          <Icon name="Cart" size={30} className="text-amber-300" />
        </div>
        <p className="text-sm font-semibold text-gray-500">장바구니에 담긴 상품이 없습니다</p>
        <p className="text-xs text-gray-400 mt-1">구매자가 담아둔 상품이 여기에 표시됩니다</p>
      </div>
    );
  }

  return (
    <div>
      {/* 소개 문구 */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
        <Icon name="Cart" size={16} className="text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-amber-800">구매하기 전에 장바구니에 담아 있습니다.</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">
            구매자에게 알림톡을 보내 구매를 유도하세요. (알림톡 연동은 준비 중입니다)
          </p>
        </div>
      </div>

      {/* 기능 버튼 (모아보기/엑셀/출력) */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button
          onClick={() => setShowCollect(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[12px] font-bold shadow-sm transition-colors"
        >
          <List size={13} /> 주문서 모아보기
        </button>
        <button
          onClick={downloadExcel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold shadow-sm transition-colors"
        >
          <Icon name="Download" size={13} /> 엑셀 다운로드
        </button>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold shadow-sm shadow-amber-200 transition-colors"
        >
          <Printer size={13} /> 주문서 출력
        </button>
      </div>

      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-amber-500"
          />
          전체 선택
          <span className="text-gray-400 font-normal">
            ({selected.size}/{groups.length}명)
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeleteSelected}
            disabled={deleting || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 text-[12px] font-bold shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            선택 삭제
          </button>
          <button
            onClick={sendBulk}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-bold shadow-sm shadow-amber-200 transition-colors"
          >
            <Icon name="Share" size={13} /> 알림톡 일괄 발송
          </button>
        </div>
      </div>

      {/* 테이블 (데스크탑) */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] text-gray-400 uppercase tracking-wide">
              <th className="w-10 py-3"></th>
              <th className="text-left px-3 py-3 font-semibold">구매자명/닉네임</th>
              <th className="text-left px-3 py-3 font-semibold">상품명</th>
              <th className="text-center px-3 py-3 font-semibold">수량</th>
              <th className="text-left px-3 py-3 font-semibold">담은 날짜</th>
              <th className="text-center px-3 py-3 font-semibold">알림톡 발송</th>
            </tr>
          </thead>
          <tbody>
            {groupPageItems.map((g) =>
              g.items.map((c, idx) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-amber-50/30">
                  {idx === 0 && (
                    <td rowSpan={g.items.length} className="text-center align-top pt-4">
                      <input
                        type="checkbox"
                        checked={selected.has(g.userId)}
                        onChange={() => toggleOne(g.userId)}
                        className="w-4 h-4 rounded accent-amber-500"
                      />
                    </td>
                  )}
                  {idx === 0 && (
                    <td rowSpan={g.items.length} className="px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {g.userName.charAt(0) || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-gray-800 truncate">{g.userName || "이름없음"}</p>
                          <p className="text-[11px] text-gray-400 truncate">{g.userEmail}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <p className="text-[13px] text-gray-700">{c.productName}</p>
                    {c.variantName && <p className="text-[11px] text-gray-400">{c.variantName}</p>}
                    <button
                      onClick={() => setMiniProduct({ productName: c.productName, variantName: c.variantName, price: c.price, quantity: c.quantity, thumbnail: c.thumbnail })}
                      className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 text-gray-600 hover:text-amber-700 text-[11px] font-semibold transition-colors"
                    >
                      <Icon name="Package" size={11} className="shrink-0" /> 상품 상세
                    </button>
                  </td>
                  <td className="text-center px-3 py-3 text-[13px] text-gray-600">{c.quantity}</td>
                  <td className="px-3 py-3 text-[12px] text-gray-500">{formatDateTime(c.createdAt)}</td>
                  {idx === 0 && (
                    <td rowSpan={g.items.length} className="text-center px-3 py-3 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={sendOne}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[12px] font-bold transition-colors"
                        >
                          <Icon name="Notification" size={12} /> 발송
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(g)}
                          disabled={deleting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 size={12} /> 삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination currentPage={groupPage} totalPages={groupTotalPages} onPageChange={setGroupPage} />
      </div>

      {/* 카드 (모바일) */}
      <div className="md:hidden space-y-3">
        {groupPageItems.map((g) => (
          <div key={g.userId} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer min-w-0">
                <input
                  type="checkbox"
                  checked={selected.has(g.userId)}
                  onChange={() => toggleOne(g.userId)}
                  className="w-4 h-4 rounded accent-amber-500 shrink-0"
                />
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {g.userName.charAt(0) || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 truncate">{g.userName || "이름없음"}</p>
                  <p className="text-[11px] text-gray-400 truncate">{g.userEmail}</p>
                </div>
              </label>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={sendOne}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[12px] font-bold transition-colors"
                >
                  <Icon name="Notification" size={12} /> 발송
                </button>
                <button
                  onClick={() => handleDeleteGroup(g)}
                  disabled={deleting}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 border border-red-200 text-red-600 text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>
            <div className="space-y-2 pl-1">
              {g.items.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="text-gray-700 truncate">
                      {c.productName}
                      {c.variantName && <span className="text-gray-400"> · {c.variantName}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">{formatDateTime(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-500">{c.quantity}개</span>
                    <button
                      onClick={() => setMiniProduct({ productName: c.productName, variantName: c.variantName, price: c.price, quantity: c.quantity, thumbnail: c.thumbnail })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 hover:bg-amber-50 border border-gray-200 text-gray-600 text-[11px] font-semibold transition-colors"
                    >
                      <Icon name="Package" size={11} /> 상세
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Pagination currentPage={groupPage} totalPages={groupTotalPages} onPageChange={setGroupPage} />
      </div>

      {/* 상품 상세 미니 모달 */}
      {miniProduct && <ProductMiniModal product={miniProduct} onClose={() => setMiniProduct(null)} />}

      {/* 주문서 모아보기 모달 */}
      {showCollect && (
        <SheetCollectModal
          title="장바구니 모아보기"
          subtitle={`총 ${groups.length}명`}
          html={buildCartSheetsHtml(groups, sellerName, false)}
          onPrint={downloadPDF}
          onClose={() => setShowCollect(false)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] animate-toast-slide-down">
          <div className="bg-gray-900 text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-xl flex items-center gap-2">
            <Icon name="Check" size={16} className="text-amber-400" />
            {toast}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes toast-slide-down {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-slide-down { animation: toast-slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}
