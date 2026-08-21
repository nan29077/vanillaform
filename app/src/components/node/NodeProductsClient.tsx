"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import { useRouter } from "next/navigation";
import {Loader2, Save, Coins, Building2} from 'lucide-react';
import { useAppDialog } from "@/components/shared/AppDialog";
import Pagination, { usePagination } from "@/components/shared/Pagination";

type NodeProduct = {
  id: string;
  name: string;
  thumbnail: string | null;
  brandName: string | null;
  middleAdminName: string | null;
  viaMiddleAdmin: boolean;
  categoryName: string | null;
  supplyPrice: number | null;
  basePrice: number;
  middleAdminMargin: number | null;
  nodeMargin: number | null;
  nodeMarginType: string | null;
  nodeApprovedAt: string | null;
  createdAt: string;
};

const won = (n: number | null | undefined) =>
  n == null ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`;

// 노드 마진 적용 후 예상가 (미리보기)
function previewPrice(base: number, margin: number | null, type: string | null): number {
  if (margin == null) return base;
  if (type === "RATE") return Math.round(base + (base * margin) / 100);
  return Math.round(base + margin);
}

export default function NodeProductsClient({
  initialPending,
  initialApproved,
}: {
  initialPending: NodeProduct[];
  initialApproved: NodeProduct[];
}) {
  const router = useRouter();
  const { appAlert, appConfirm } = useAppDialog();
  const [pending, setPending] = useState<NodeProduct[]>(initialPending);
  const [approved, setApproved] = useState<NodeProduct[]>(initialApproved);

  // 행별 입력 상태
  const [drafts, setDrafts] = useState<Record<string, { margin: string; type: "AMOUNT" | "RATE" }>>(
    () =>
      Object.fromEntries(
        initialPending.map((p) => [
          p.id,
          {
            margin: p.nodeMargin != null ? String(p.nodeMargin) : "",
            type: (p.nodeMarginType === "RATE" ? "RATE" : "AMOUNT") as "AMOUNT" | "RATE",
          },
        ]),
      ),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    pageItems: pendingItems,
    page: pendingPage,
    setPage: setPendingPage,
    totalPages: pendingTotalPages,
  } = usePagination(pending, 20);
  const {
    pageItems: approvedItems,
    page: approvedPage,
    setPage: setApprovedPage,
    totalPages: approvedTotalPages,
  } = usePagination(approved, 20);

  const updateDraft = (id: string, patch: Partial<{ margin: string; type: "AMOUNT" | "RATE" }>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  async function submit(p: NodeProduct, finalize: boolean) {
    const draft = drafts[p.id] || { margin: "", type: "AMOUNT" as const };
    const marginNum = draft.margin === "" ? null : parseFloat(draft.margin);
    if (finalize) {
      if (marginNum == null || isNaN(marginNum) || marginNum < 0) {
        await appAlert("최종 등록하려면 유효한 마진 값을 입력하세요.");
        return;
      }
      const ok = await appConfirm(
        `"${p.name}" 상품을 마진 ${draft.type === "RATE" ? `${marginNum}%` : won(marginNum)} 으로 최종 등록할까요?\n최종 등록 후 최고관리자 승인 단계로 넘어갑니다.`,
      );
      if (!ok) return;
    }

    setBusyId(p.id);
    try {
      const res = await fetch("/api/node/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: p.id,
          nodeMargin: draft.margin === "" ? null : marginNum,
          nodeMarginType: draft.type,
          finalize,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await appAlert(data.error || "처리에 실패했습니다.");
        return;
      }
      if (finalize) {
        // 대기 목록 → 최종 등록 완료 목록으로 이동
        setPending((prev) => prev.filter((x) => x.id !== p.id));
        setApproved((prev) => [
          {
            ...p,
            nodeMargin: marginNum,
            nodeMarginType: draft.type,
            nodeApprovedAt: data.product?.nodeApprovedAt || new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setPending((prev) =>
          prev.map((x) =>
            x.id === p.id ? { ...x, nodeMargin: marginNum, nodeMarginType: draft.type } : x,
          ),
        );
        await appAlert("마진을 임시 저장했습니다.");
      }
      router.refresh();
    } catch {
      await appAlert("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 마진 설정 대기 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Clock" size={16} strokeWidth={1.75} className="text-amber-500" />
          <h2 className="text-sm font-bold text-gray-700">마진 설정 대기 ({pending.length})</h2>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Icon name="Package" size={22} strokeWidth={1.5} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">노드로 들어온 대기 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((p) => {
              const draft = drafts[p.id] || { margin: "", type: "AMOUNT" as const };
              const marginNum = draft.margin === "" ? null : parseFloat(draft.margin);
              const preview = previewPrice(p.basePrice, isNaN(marginNum as number) ? null : marginNum, draft.type);
              const busy = busyId === p.id;
              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnail} alt={p.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon name="Package" size={18} strokeWidth={1.5} className="text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5">
                          {p.viaMiddleAdmin ? <Building2 size={11} strokeWidth={1.75} /> : <Icon name="Store" size={11} strokeWidth={1.75} />}
                          {p.viaMiddleAdmin
                            ? `중간관리자${p.middleAdminName ? ` · ${p.middleAdminName}` : ""}`
                            : "브랜드 단독"}
                        </span>
                        {p.brandName && (
                          <span className="text-[11px] text-gray-400">{p.brandName}</span>
                        )}
                        {p.categoryName && (
                          <span className="text-[11px] text-gray-300">· {p.categoryName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-[10px] text-gray-400">공급가</p>
                      <p className="text-[13px] font-semibold text-gray-700">{won(p.supplyPrice)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-[10px] text-gray-400">중간관리자 마진</p>
                      <p className="text-[13px] font-semibold text-gray-700">{won(p.middleAdminMargin)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-[10px] text-gray-400">현재 판매가</p>
                      <p className="text-[13px] font-semibold text-gray-700">{won(p.basePrice)}</p>
                    </div>
                  </div>

                  {/* 노드 마진 입력 */}
                  <div className="flex flex-wrap items-end gap-2 mt-3">
                    <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5">
                      <button
                        type="button"
                        onClick={() => updateDraft(p.id, { type: "AMOUNT" })}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                          draft.type === "AMOUNT" ? "bg-brand-500 text-black" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <Coins size={13} strokeWidth={1.75} /> 금액
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft(p.id, { type: "RATE" })}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                          draft.type === "RATE" ? "bg-brand-500 text-black" : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <Icon name="Discount" size={13} strokeWidth={1.75} /> 비율
                      </button>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] text-gray-400 mb-0.5">
                        노드 마진 ({draft.type === "RATE" ? "%" : "원"})
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={draft.margin}
                        onChange={(e) => updateDraft(p.id, { margin: e.target.value })}
                        placeholder={draft.type === "RATE" ? "예: 10" : "예: 5000"}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/30"
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">적용 예상가</p>
                      <p className="text-sm font-bold text-brand-700">{won(preview)}</p>
                    </div>
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => submit(p, false)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.75} />}
                      임시 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => submit(p, true)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Icon name="Share" size={14} strokeWidth={1.75} />}
                      최종 등록
                    </button>
                  </div>
                </div>
              );
            })}
            <Pagination currentPage={pendingPage} totalPages={pendingTotalPages} onPageChange={setPendingPage} />
          </div>
        )}
      </section>

      {/* 최종 등록 완료 (최고관리자 승인 대기) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Check" size={16} strokeWidth={1.75} className="text-emerald-500" />
          <h2 className="text-sm font-bold text-gray-700">최종 등록 완료 · 최고관리자 승인 대기 ({approved.length})</h2>
        </div>
        {approved.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-gray-400">최종 등록한 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {approvedItems.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt={p.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="Package" size={16} strokeWidth={1.5} className="text-gray-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {p.brandName ? `${p.brandName} · ` : ""}노드 마진{" "}
                    {p.nodeMargin != null
                      ? p.nodeMarginType === "RATE"
                        ? `${p.nodeMargin}%`
                        : won(p.nodeMargin)
                      : "-"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1">
                  <Icon name="Check" size={12} strokeWidth={1.75} /> 등록 완료
                </span>
              </div>
            ))}
            <Pagination currentPage={approvedPage} totalPages={approvedTotalPages} onPageChange={setApprovedPage} />
          </div>
        )}
      </section>
    </div>
  );
}
