"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useRef } from "react";
import {Loader2, PlayCircle} from 'lucide-react';
import Link from "next/link";
import { useAppDialog } from "@/components/shared/AppDialog";

interface Props {
  productId: string;
  // 삭제 확인 모달에 "무엇을" 지우는지 보여주기 위한 상품명. 없으면 문구에서 생략된다.
  productName?: string;
  mode: "admin" | "brand" | "seller";
  isActive: boolean;
  ownerLabel?: string;
  shopProductId?: string;
  shopProductActive?: boolean;
  showDetailButton?: boolean;
}

export default function ProductItemActions({ productId, productName, mode, isActive, ownerLabel, shopProductId, shopProductActive, showDetailButton }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  // 드롭다운을 fixed로 띄워 overflow-hidden 컨테이너에 잘리지 않도록 위치 계산
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const { appConfirm, appAlert } = useAppDialog();

  const toggleMenu = () => {
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setShowMenu(true);
  };

  const handleAction = async (action: string) => {
    setLoading(true);
    try {
      if (action === "delete") {
        const target = productName ? `“${productName}”\n\n` : "";
        if (!await appConfirm({ message: `${target}정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`, type: "warning", confirmText: "삭제" })) {
          setLoading(false);
          return;
        }
      }
      const body: any = { productId, action };
      if (shopProductId) body.shopProductId = shopProductId;

      const res = await fetch("/api/products/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        await appAlert({ message: data.error || "작업 실패", type: "warning" });
      }
    } catch {
      await appAlert({ message: "오류가 발생했습니다.", type: "warning" });
    }
    setLoading(false);
    setShowMenu(false);
  };

  if (loading) {
    return <Loader2 size={16} className="animate-spin text-gray-400" />;
  }

  const isShopActive = shopProductActive !== undefined ? shopProductActive : isActive;

  return (
    <div className="relative flex-shrink-0 flex items-center gap-1">
      {/* 상세보기 버튼 */}
      {showDetailButton && (
        <Link
          href={`/products/${productId}`}
          onClick={e => e.stopPropagation()}
          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
          title="상세보기"
        >
          <Icon name="ArrowRight" size={14} />
        </Link>
      )}

      {/* 판매 상태 제어 바로가기 버튼 (shopProduct가 있을 때) */}
      {shopProductId && (
        <div className="flex items-center gap-0.5">
          {isShopActive ? (
            <>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction("pauseSale"); }}
                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition-colors"
                title="일시중지"
              >
                <Icon name="Pause" size={14} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction("stopSale"); }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                title="판매중지"
              >
                <Icon name="Close" size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAction("startSale"); }}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-colors"
              title="판매재시작"
            >
              <Icon name="Reorder" size={14} />
            </button>
          )}
        </div>
      )}

      <button
        ref={menuBtnRef}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Icon name="Menu" size={16} />
      </button>

      {showMenu && menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div
            style={{ position: "fixed", top: menuPos.top, right: menuPos.right }}
            className="z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 min-w-[180px] overflow-hidden animate-scale-in"
          >
            {/* 판매 상태 제어 */}
            {shopProductId ? (
              <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100">
                <p className="text-[9px] text-gray-400 font-medium px-2 mb-1">판매 상태</p>
                {isShopActive ? (
                  <>
                    <button
                      onClick={() => handleAction("pauseSale")}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Icon name="Pause" size={14} /> 일시중지
                    </button>
                    <button
                      onClick={() => handleAction("stopSale")}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Icon name="Close" size={14} /> 판매중지
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction("startSale")}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Icon name="Reorder" size={14} /> 판매재시작
                  </button>
                )}
              </div>
            ) : (
              <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100">
                <button
                  onClick={() => handleAction(isActive ? "hide" : "show")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                >
                  {isActive ? <Icon name="Eye" size={14} /> : <Icon name="Eye" size={14} />}
                  {isActive ? "숨기기" : "공개"}
                </button>
              </div>
            )}

            {/* 전체 숨기기/공개 (관리자/브랜드) */}
            {(mode === "admin" || mode === "brand") && (
              <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100">
                <button
                  onClick={() => handleAction(isActive ? "hide" : "show")}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                >
                  {isActive ? <Icon name="Eye" size={14} /> : <Icon name="Eye" size={14} />}
                  {isActive ? "전체 숨기기" : "전체 공개"}
                </button>
              </div>
            )}

            {/* 상세보기 */}
            <div className="px-2">
              <Link
                href={`/products/${productId}`}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Icon name="ArrowRight" size={14} /> 상품 상세보기
              </Link>
            </div>

            {/* Edit */}
            <div className="px-2">
              {mode === "seller" ? (
                <button
                  onClick={() => { window.location.href = `/seller/products/edit/${productId}`; }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Icon name="Edit" size={14} /> 수정
                </button>
              ) : (
                <button
                  onClick={() => { window.location.href = `/${mode === "admin" ? "admin" : "brand"}/products/edit/${productId}`; }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Icon name="Edit" size={14} /> 수정
                </button>
              )}
            </div>

            <div className="px-2 pt-1.5 mt-1.5 border-t border-gray-100">
              <button
                onClick={() => handleAction("delete")}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Icon name="Delete" size={14} /> 삭제
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95) translateY(-4px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-scale-in { animation: scale-in 0.15s ease-out; }
      `}</style>
    </div>
  );
}
