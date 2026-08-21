"use client";

/**
 * OptionGroupEditor
 * ─────────────────
 * 다차원 옵션 그룹 편집 UI
 *
 * 두 가지 모드:
 *   "flat"  — 기존 단순 옵션 목록 (하위호환)
 *   "group" — 색상/사이즈 등 다차원 그룹 지원
 *
 * 부모가 넘겨줘야 할 데이터:
 *   optionMode   : "flat" | "group"
 *   variants     : { name: string; price: string; stock: string }[]
 *   optionGroups : OptionGroup[]
 *   basePrice    : string  (기준 가격, flat 모드 신규 variant 기본값)
 *   onChange     : (patch: { optionMode?, variants?, optionGroups? }) => void
 */

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X} from 'lucide-react';

export interface Variant {
  name: string;
  price: string;
  stock: string;
}

export interface OptionGroup {
  groupName: string;
  options: string[];
}

interface Props {
  optionMode: "flat" | "group";
  variants: Variant[];
  optionGroups: OptionGroup[];
  basePrice: string;
  onChange: (patch: {
    optionMode?: "flat" | "group";
    variants?: Variant[];
    optionGroups?: OptionGroup[];
  }) => void;
}

// 다차원 조합 생성 (카테시안 곱)
function cartesian(groups: OptionGroup[]): string[] {
  if (groups.length === 0 || groups.some((g) => g.options.length === 0)) return [];
  return groups
    .reduce<string[][]>(
      (acc, group) =>
        acc.flatMap((combo) => group.options.map((opt) => [...combo, opt])),
      [[]]
    )
    .map((combo) => combo.join("/"));
}

export default function OptionGroupEditor({
  optionMode,
  variants,
  optionGroups,
  basePrice,
  onChange,
}: Props) {
  const [newOptionInputs, setNewOptionInputs] = useState<Record<number, string>>({});

  // 모드 전환
  const switchMode = (mode: "flat" | "group") => {
    if (mode === optionMode) return;
    if (mode === "group") {
      // flat → group: 기존 variants 지우고 그룹 초기화
      onChange({ optionMode: "group", variants: [], optionGroups: [] });
    } else {
      // group → flat: 조합 variants 유지하거나 초기화
      onChange({ optionMode: "flat", optionGroups: [] });
    }
    setNewOptionInputs({});
  };

  // ─── flat 모드 ───────────────────────────────────────

  const addFlatVariant = () =>
    onChange({ variants: [...variants, { name: "", price: basePrice, stock: "0" }] });

  const removeFlatVariant = (i: number) =>
    onChange({ variants: variants.filter((_, idx) => idx !== i) });

  const updateFlatVariant = (i: number, k: keyof Variant, v: string) => {
    const nv = [...variants];
    nv[i] = { ...nv[i], [k]: v };
    onChange({ variants: nv });
  };

  // ─── group 모드 ──────────────────────────────────────

  const addGroup = () =>
    onChange({ optionGroups: [...optionGroups, { groupName: "", options: [] }] });

  const removeGroup = (gi: number) => {
    const newGroups = optionGroups.filter((_, i) => i !== gi);
    const newVariants = rebuildVariants(newGroups, variants);
    onChange({ optionGroups: newGroups, variants: newVariants });
  };

  const updateGroupName = (gi: number, name: string) => {
    const ng = [...optionGroups];
    ng[gi] = { ...ng[gi], groupName: name };
    onChange({ optionGroups: ng });
  };

  const addOption = (gi: number, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (optionGroups[gi].options.includes(trimmed)) return;
    const ng = [...optionGroups];
    ng[gi] = { ...ng[gi], options: [...ng[gi].options, trimmed] };
    const newVariants = rebuildVariants(ng, variants);
    onChange({ optionGroups: ng, variants: newVariants });
    setNewOptionInputs((p) => ({ ...p, [gi]: "" }));
  };

  const removeOption = (gi: number, oi: number) => {
    const ng = [...optionGroups];
    ng[gi] = { ...ng[gi], options: ng[gi].options.filter((_, i) => i !== oi) };
    const newVariants = rebuildVariants(ng, variants);
    onChange({ optionGroups: ng, variants: newVariants });
  };

  /** 그룹 변경 시 기존 variant 가격/재고를 유지하면서 조합 재생성 */
  function rebuildVariants(groups: OptionGroup[], prev: Variant[]): Variant[] {
    const combos = cartesian(groups);
    return combos.map((name) => {
      const existing = prev.find((v) => v.name === name);
      return existing ?? { name, price: basePrice, stock: "0" };
    });
  }

  const updateComboVariant = (i: number, k: keyof Variant, v: string) => {
    const nv = [...variants];
    nv[i] = { ...nv[i], [k]: v };
    onChange({ variants: nv });
  };

  // ─── 렌더 ────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* 모드 토글 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => switchMode("flat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            optionMode === "flat"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 text-gray-500 hover:border-gray-400"
          }`}
        >
          <Icon name="Tag" size={12} />
          단순 옵션
        </button>
        <button
          type="button"
          onClick={() => switchMode("group")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            optionMode === "group"
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 text-gray-500 hover:border-gray-400"
          }`}
        >
          <Icon name="ProductOption_icon" size={12} />
          그룹 옵션 (색상×사이즈 등)
        </button>
      </div>

      {/* ── 단순 옵션 모드 ── */}
      {optionMode === "flat" && (
        <div className="space-y-2">
          {variants.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">옵션이 없습니다. 색상·사이즈 등이 있으면 추가하세요.</p>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="grid grid-cols-[1fr_100px_80px_32px] gap-2 px-1">
                <span className="text-[10px] text-gray-400 font-medium">옵션명</span>
                <span className="text-[10px] text-gray-400 font-medium text-right">가격(원)</span>
                <span className="text-[10px] text-gray-400 font-medium text-right">재고</span>
                <span />
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_80px_32px] gap-2 items-center">
                  <input
                    type="text"
                    className="input-field text-xs py-2"
                    placeholder="예: 빨강 / M"
                    value={v.name}
                    onChange={(e) => updateFlatVariant(i, "name", e.target.value)}
                  />
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      className="input-field text-xs py-2 pr-6"
                      placeholder={basePrice || "0"}
                      value={v.price}
                      onChange={(e) => updateFlatVariant(i, "price", e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      className="input-field text-xs py-2 pr-6"
                      placeholder="0"
                      value={v.stock}
                      onChange={(e) => updateFlatVariant(i, "stock", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFlatVariant(i)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 pt-1">
                총 재고: {variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0).toLocaleString()}개
              </p>
            </>
          )}
          <button
            type="button"
            onClick={addFlatVariant}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium mt-1"
          >
            <Icon name="Plus" size={14} /> 옵션 추가
          </button>
        </div>
      )}

      {/* ── 그룹 옵션 모드 ── */}
      {optionMode === "group" && (
        <div className="space-y-4">
          {/* 그룹 목록 */}
          {optionGroups.map((group, gi) => (
            <div key={gi} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50">
              {/* 그룹명 + 삭제 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="input-field text-xs py-1.5 flex-1"
                  placeholder="그룹명 (예: 색상, 사이즈)"
                  value={group.groupName}
                  onChange={(e) => updateGroupName(gi, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeGroup(gi)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>

              {/* 옵션값들 */}
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt, oi) => (
                  <span
                    key={oi}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-700"
                  >
                    {opt}
                    <button
                      type="button"
                      onClick={() => removeOption(gi, oi)}
                      className="text-gray-300 hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>

              {/* 옵션값 추가 입력 */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  className="input-field text-xs py-1.5 flex-1"
                  placeholder={`옵션값 입력 후 Enter (예: ${gi === 0 ? "빨강" : "S"})`}
                  value={newOptionInputs[gi] || ""}
                  onChange={(e) =>
                    setNewOptionInputs((p) => ({ ...p, [gi]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption(gi, newOptionInputs[gi] || "");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => addOption(gi, newOptionInputs[gi] || "")}
                  className="px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0"
                >
                  <Icon name="Plus" size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* 그룹 추가 버튼 */}
          <button
            type="button"
            onClick={addGroup}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            <Icon name="Plus" size={14} /> 옵션 그룹 추가
          </button>

          {/* 조합 결과 테이블 */}
          {variants.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-gray-600 mb-2">
                조합 ({variants.length}개) — 가격·재고 설정
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 헤더 */}
                <div className="grid grid-cols-[1fr_100px_80px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-[10px] text-gray-500 font-medium">조합</span>
                  <span className="text-[10px] text-gray-500 font-medium text-right">가격(원)</span>
                  <span className="text-[10px] text-gray-500 font-medium text-right">재고</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                  {variants.map((v, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_100px_80px] gap-2 px-3 py-2 items-center hover:bg-gray-50/50 transition-colors"
                    >
                      <span className="text-[11px] text-gray-800 font-medium">{v.name}</span>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          className="input-field text-xs py-1.5 pr-5 text-right"
                          placeholder={basePrice || "0"}
                          value={v.price}
                          onChange={(e) => updateComboVariant(i, "price", e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          className="input-field text-xs py-1.5 text-right"
                          placeholder="0"
                          value={v.stock}
                          onChange={(e) => updateComboVariant(i, "stock", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                총 재고: {variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0).toLocaleString()}개
              </p>
            </div>
          )}

          {optionGroups.length === 0 && (
            <div className="border border-dashed border-gray-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400">
                그룹을 추가해 옵션을 구성하세요.
                <br />예: "색상" → 빨강/파랑, "사이즈" → S/M/L
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
