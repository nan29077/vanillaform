"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {Instagram, Youtube, Facebook, Link2, Loader2, Lightbulb, Maximize2, X, Check} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import HexNumBadge from "@/components/shared/HexNumBadge";

function TikTokIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 5.5a4.5 4.5 0 0 0 4 2.4V11a7.7 7.7 0 0 1-4-1.1v5.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.07v2.9a2.7 2.7 0 1 0 1.9 2.6V2.5h2.8c0 .26.02.5.05.75A4.5 4.5 0 0 0 16.5 5.5z" />
    </svg>
  );
}

const PLATFORMS: { key: string; label: string; icon: any }[] = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "tiktok", label: "TikTok", icon: TikTokIcon },
  { key: "facebook", label: "Facebook", icon: Facebook },
];

interface ShopProduct {
  id: string;
  name: string;
  thumbnail: string | null;
  basePrice: number;
}

interface Props {
  initial: {
    isManualLive: boolean;
    livePlatform: string | null;
    liveLink: string | null;
    manualLiveProductIds: string[];
  };
}

export default function ShopLiveSettings({ initial }: Props) {
  const router = useRouter();
  const { appAlert } = useAppDialog();
  const [isLive, setIsLive] = useState(initial.isManualLive);
  const [platform, setPlatform] = useState<string | null>(initial.livePlatform);
  const [link, setLink] = useState(initial.liveLink ?? "");
  const [toggling, setToggling] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [savedLink, setSavedLink] = useState(false);

  // 라이브 노출 상품 선택
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initial.manualLiveProductIds || []);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingProducts, setSavingProducts] = useState(false);
  const [savedProducts, setSavedProducts] = useState(false);

  // 크게 보기 팝업
  const [isLargeViewOpen, setIsLargeViewOpen] = useState(false);

  // 스위치가 ON일 때 상품 목록 로드 (한 번만)
  useEffect(() => {
    if (isLive && shopProducts.length === 0 && !loadingProducts) {
      setLoadingProducts(true);
      fetch("/api/live/products")
        .then((r) => r.json())
        .then((data) => setShopProducts(data.products || []))
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [isLive]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/seller/shop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "저장에 실패했습니다.");
    }
  };

  const toggleLive = async () => {
    const next = !isLive;
    setIsLive(next);
    setToggling(true);
    try {
      await patch({ isManualLive: next });
      router.refresh();
    } catch (e: any) {
      setIsLive(!next);
      await appAlert({ message: e.message || "저장에 실패했습니다.", type: "warning" });
    } finally {
      setToggling(false);
    }
  };

  const saveLink = async () => {
    setSavingLink(true);
    setSavedLink(false);
    try {
      await patch({ livePlatform: platform, liveLink: link.trim() || null });
      setSavedLink(true);
      router.refresh();
    } catch (e: any) {
      await appAlert({ message: e.message || "저장에 실패했습니다.", type: "warning" });
    } finally {
      setSavingLink(false);
    }
  };

  // 선택한 상품 순서 변경 (위/아래)
  const moveProduct = (index: number, dir: -1 | 1) => {
    setSelectedProductIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSavedProducts(false);
  };

  const saveProducts = async () => {
    setSavingProducts(true);
    setSavedProducts(false);
    try {
      await patch({ manualLiveProductIds: selectedProductIds });
      setSavedProducts(true);
      router.refresh();
    } catch (e: any) {
      await appAlert({ message: e.message || "저장에 실패했습니다.", type: "warning" });
    } finally {
      setSavingProducts(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-3">
        <Icon name="Live" size={15} className="text-red-500" />
        <h3 className="text-sm font-bold text-gray-900">라이브 표시 설정</h3>
      </div>

      {/* 기능 안내문 */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3 mb-3.5">
        <Icon name="Info" size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-relaxed">
          이 기능은 바닐라폼 앱 내 라이브 방송 없이, 유튜브·인스타그램·틱톡 등 외부 SNS에서만 라이브를 진행할 때 사용하세요.
          외부 SNS 라이브 진행 중 이 스위치를 켜면 라이브 셀러샵에 <b>&ldquo;라이브 중&rdquo;</b> 표시와 함께 선택한 상품이 노출됩니다.
        </p>
      </div>

      {/* A. 라이브 중 수동 스위치 */}
      <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-gray-50">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">라이브 중 표시</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
            스위치를 켜면 라이브 커머스 기능과 관계없이 라이브 셀러 샵 프로필에 &lsquo;라이브 중&rsquo; 표시가 나타납니다.
            실제 방송 중일 때만 사용해 주세요.
          </p>
        </div>
        {toggling ? (
          <Loader2 size={18} className="animate-spin text-gray-400 flex-shrink-0 mt-1" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={isLive}
            onClick={toggleLive}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors mt-1 ${
              isLive ? "bg-red-500" : "bg-gray-200"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isLive ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        )}
      </div>

      {/* 스위치 ON 시: 안내 + 상품 선택 */}
      {isLive && (
        <>
          <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
            <Lightbulb size={15} className="text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-600 leading-relaxed">
              <b className="text-gray-800">바닐라폼 라이브 커머스를 실행하면 자동으로 우선 적용</b>됩니다.
              이 경우 &lsquo;라이브 중 표시&rsquo;의 외부 링크 대신 바닐라폼 라이브 방송 화면으로 연결돼요.
            </p>
          </div>

          {/* 라이브 노출 상품 선택 */}
          <div className="mt-3.5 pt-3.5 border-t border-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900">라이브 노출 상품 선택</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  선택한 상품이 라이브 셀러샵 &ldquo;현재 라이브 중 상품&rdquo; 탭에 표시됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                  {selectedProductIds.length}개 선택
                </span>
                <button
                  type="button"
                  onClick={() => setIsLargeViewOpen(true)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  title="크게 보기"
                >
                  <Maximize2 size={12} />
                  크게 보기
                </button>
              </div>
            </div>

            {loadingProducts ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Loader2 size={20} className="animate-spin mx-auto text-gray-300" />
              </div>
            ) : shopProducts.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Icon name="Cart" size={24} className="mx-auto text-gray-300 mb-1" />
                <p className="text-xs text-gray-400">상품관리에서 상품을 추가해주세요.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto border border-gray-100 rounded-xl p-2">
                {shopProducts.map((p) => {
                  const isSelected = selectedProductIds.includes(p.id);
                  const selectedIdx = selectedProductIds.indexOf(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected ? "bg-red-50 border border-red-200" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedProductIds((prev) => [...prev, p.id]);
                          else setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                          setSavedProducts(false);
                        }}
                        className="accent-red-500 w-4 h-4 flex-shrink-0"
                      />
                      {p.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400">{p.basePrice.toLocaleString()}원</p>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {selectedIdx + 1}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {/* 선택한 상품 노출 순서 변경 */}
            {selectedProductIds.length > 0 && (
              <div className="mt-3.5 pt-3.5 border-t border-gray-50">
                <p className="text-sm font-medium text-gray-900">노출 순서 변경</p>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-2">
                  위/아래 화살표로 라이브 셀러샵에 표시되는 상품 순서를 조정하세요.
                </p>
                <div className="space-y-1.5">
                  {selectedProductIds.map((pid, idx) => {
                    const p = shopProducts.find((sp) => sp.id === pid);
                    if (!p) return null;
                    return (
                      <div
                        key={pid}
                        className="flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-gray-50/60"
                      >
                        <HexNumBadge size={20} fontSize={9} className="flex-shrink-0">
                          {idx + 1}
                        </HexNumBadge>
                        {p.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <p className="flex-1 min-w-0 text-xs font-medium text-gray-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => moveProduct(idx, -1)}
                            disabled={idx === 0}
                            aria-label="위로 이동"
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Icon name="ChevronDown" size={15} className="rotate-180" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveProduct(idx, 1)}
                            disabled={idx === selectedProductIds.length - 1}
                            aria-label="아래로 이동"
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Icon name="ChevronDown" size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={saveProducts}
                disabled={savingProducts || loadingProducts}
                className="inline-flex items-center gap-1.5 bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {savingProducts ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : savedProducts ? (
                  <Icon name="Check" size={14} />
                ) : (
                  <Icon name="Package" size={14} />
                )}
                {savedProducts ? "저장됨" : "상품 저장"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* B. 라이브 연동 링크 */}
      <div className="pt-3.5 mt-3.5 border-t border-gray-50">
        <p className="text-sm font-medium text-gray-900">라이브 연동 링크</p>
        <p className="text-[11px] text-gray-400 mt-0.5 mb-2.5">
          외부 플랫폼에서 방송 중이라면 링크를 연결하세요. 프로필 사진 클릭 시 해당 라이브로 이동합니다.
        </p>

        {/* 플랫폼 선택 */}
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            const active = platform === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPlatform(active ? null : p.key); setSavedLink(false); }}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${
                  active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Icon size={18} className={active ? "text-brand-600" : "text-gray-500"} />
                <span className="text-[10px] font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* 링크 입력 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-400/30">
            <Link2 size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => { setLink(e.target.value); setSavedLink(false); }}
              placeholder="https://..."
              className="flex-1 text-sm text-gray-900 bg-transparent focus:outline-none min-w-0"
            />
          </div>
          <button
            type="button"
            onClick={saveLink}
            disabled={savingLink}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {savingLink ? <Loader2 size={15} className="animate-spin" /> : savedLink ? <Icon name="Check" size={15} /> : null}
            {savedLink ? "저장됨" : "저장"}
          </button>
        </div>
      </div>

      {/* 크게 보기 팝업 모달 */}
      {isLargeViewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-[90vw] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* 헤더 - 바닐라 플라워 테마 */}
            <div className="bg-gradient-to-r from-yellow-400 to-amber-400 p-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl"></span>
                <h2 className="text-base font-bold text-white">라이브 노출 상품 선택</h2>
                <span className="text-[11px] font-bold text-yellow-900 bg-yellow-200 px-2 py-0.5 rounded-full">
                  {selectedProductIds.length}개 선택
                </span>
              </div>
              <button onClick={() => setIsLargeViewOpen(false)} className="text-white hover:text-yellow-100 transition-colors">
                <X size={22} />
              </button>
            </div>

            {/* 상품 목록 */}
            <div className="overflow-y-auto flex-1 p-4">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : shopProducts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Icon name="Cart" size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">상품관리에서 상품을 추가해주세요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shopProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const selectedIdx = selectedProductIds.indexOf(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                          else setSelectedProductIds((prev) => [...prev, p.id]);
                          setSavedProducts(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isSelected ? "border-red-300 bg-red-50" : "border-gray-100 hover:bg-yellow-50 hover:border-yellow-200"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "border-red-500 bg-red-500" : "border-gray-300"}`}>
                          {isSelected && <Check size={13} className="text-white" />}
                        </div>
                        {p.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.basePrice.toLocaleString()}원</p>
                        </div>
                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {selectedIdx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 하단 확인 버튼 */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setIsLargeViewOpen(false)}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-400 text-white rounded-xl py-3 font-bold text-sm hover:from-yellow-500 hover:to-amber-500 transition-all"
              >
                선택 완료 ({selectedProductIds.length}개)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
