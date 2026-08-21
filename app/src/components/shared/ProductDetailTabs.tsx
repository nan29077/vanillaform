"use client";

import { Icon } from '@/components/shared/Icon';
import { useState, useEffect } from "react";
import {Scale} from 'lucide-react';

function stripEmoji(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|\u26A0\uFE0F|\uD83D\uDCC9|\uD83D\uDCC8|\u2705|\uD83D\uDE4F|\u2696\uFE0F/gu, "").trim();
}

function RefundPolicyBlock({ text }: { text: string }) {
  const normalizedText = stripEmoji(text).replace(/\s+/g, " ").trim();
  const lines = normalizedText.split(/\s*(?=\d+\.\s|\u203B)/);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden text-[12px]">
      <div className="flex items-center gap-2 bg-gray-50 px-3.5 py-2.5 border-b border-gray-100">
        <Icon name="Warning" size={13} className="text-amber-500 flex-shrink-0" />
        <span className="font-bold text-gray-800 text-[13px]">교환 및 환불 규정</span>
      </div>
      <div className="divide-y divide-gray-50">
        {lines.map((line, i) => {
          const cleaned = stripEmoji(line);
          const isNumbered = /^\d+\./.test(cleaned);
          const isFootnote = cleaned.startsWith("\u203B");

          if (isNumbered) {
            const titleMatch = cleaned.match(/^(\d+\.\s[^\s].*?)(?:\s{2,}|\n)([\s\S]*)$/);
            let title = cleaned;
            let body = "";
            if (titleMatch) {
              title = titleMatch[1];
              body = titleMatch[2].trim();
            } else {
              const idx = cleaned.indexOf(" ", 3);
              if (idx > 0) {
                const parenEnd = cleaned.indexOf(")", 3);
                if (parenEnd > 0) {
                  title = cleaned.substring(0, parenEnd + 1);
                  body = cleaned.substring(parenEnd + 1).trim();
                }
              }
            }
            return (
              <div key={i} className="px-3.5 py-3">
                <p className="font-semibold text-gray-800 mb-1">{stripEmoji(title)}</p>
                {body && <p className="text-gray-500 leading-relaxed">{stripEmoji(body)}</p>}
              </div>
            );
          }

          if (isFootnote) {
            return (
              <div key={i} className="px-3.5 py-3 bg-gray-50/60 flex items-start gap-2">
                <Scale size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <p className="text-gray-500 leading-relaxed">{stripEmoji(cleaned.replace(/^\u203B\s*법적\s*안내\s*/, "\u203B 법적 안내  "))}</p>
              </div>
            );
          }

          return cleaned ? (
            <div key={i} className="px-3.5 py-2.5">
              <p className="text-gray-500 leading-relaxed">{stripEmoji(cleaned)}</p>
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
}

function renderDescription(text: string) {
  if (text.includes("교환 및 환불 규정") || text.includes("교환\u00B7환불")) {
    const policyIdx = text.search(/\u26A0\uFE0F?\s*\[?교환 및 환불 규정/);
    const beforePolicy = policyIdx > 0 ? text.substring(0, policyIdx).trim() : "";
    const policyText = policyIdx >= 0 ? text.substring(policyIdx) : text;
    const cleanPolicy = policyText.replace(/^\u26A0\uFE0F?\s*\[?교환 및 환불 규정\]?\s*/u, "").trim();
    return (
      <div className="space-y-3">
        {beforePolicy && (
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{beforePolicy}</p>
        )}
        <RefundPolicyBlock text={cleanPolicy} />
      </div>
    );
  }
  return <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{text}</div>;
}

// 플라워(honeycomb) 배경 패턴 — 은은한 호박색 육각형 타일
const HONEYCOMB_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cpath d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100' fill='none' stroke='%23d97706' stroke-opacity='0.12' stroke-width='1.2'/%3E%3Cpath d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34' fill='none' stroke='%23d97706' stroke-opacity='0.12' stroke-width='1.2'/%3E%3C/svg%3E\")";

// 표준 교환·환불 카드 노출 여부 — 임시 비노출 상태. 다시 보여주려면 true 로 변경.
const SHOW_STANDARD_REFUND_CARD = false;

// 하드코딩 표준 교환·환불 규정 (바닐라 플라워/플라워 테마 카드)
function StandardRefundCard() {
  const sections = [
    { icon: "Shipping", title: "배송", items: ["주문 후 1~3 영업일 이내 발송", "제주/도서산간 추가 배송비 발생 가능"] },
    {
      icon: "Exchange",
      title: "교환 및 반품",
      items: [
        "상품 수령 후 7일 이내 신청 가능",
        "단순 변심: 왕복 배송비 고객 부담",
        "상품 하자/오배송: 배송비 판매자 부담",
        "교환/반품 불가: 사용·훼손·라벨 제거된 상품",
      ],
    },
    {
      icon: "Warning",
      title: "교환·반품이 불가한 경우",
      items: ["고객 과실로 인한 상품 손상", "포장 개봉 후 상품 가치 현저히 감소", "시간 경과로 재판매 불가한 상품"],
    },
  ];
  // 육각형 클립 (플라워 불릿)
  const hexClip = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm">
      {/* 헤더 — 플라워 패턴 배경 + 바닐라 플라워 */}
      <div className="relative px-4 py-3.5 bg-amber-100/70 border-b border-amber-200" style={{ backgroundImage: HONEYCOMB_BG }}>
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="바닐라 플라워" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-[13.5px] font-extrabold text-amber-900 leading-tight">바닐라폼 표준 교환·환불 안내</p>
            <p className="text-[10.5px] text-amber-700/80 mt-0.5">모든 상품에 공통 적용되는 규정이에요</p>
          </div>
        </div>
      </div>

      {/* 섹션들 */}
      <div className="p-3.5 space-y-3">
        {sections.map((sec) => (
          <div key={sec.title} className="rounded-xl border border-amber-100 bg-white/80 px-3.5 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name={sec.icon} size={16} className="text-amber-600" />
              <h4 className="text-[13px] font-bold text-amber-900">{sec.title}</h4>
            </div>
            <ul className="space-y-1.5">
              {sec.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-[12px] text-gray-600 leading-relaxed">
                  <span
                    className="mt-[5px] w-[7px] h-[7px] bg-amber-400 flex-shrink-0"
                    style={{ clipPath: hexClip }}
                  />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProductDetailTabsProps {
  description?: string | null;
  detailContent?: string | null;
  reviewCount: number;
  reviewsHtml: string;
  embedded?: boolean;
}

export default function ProductDetailTabs({
  description,
  detailContent,
  reviewCount,
  reviewsHtml,
  embedded = false,
}: ProductDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "review" | "info">("detail");
  const [refundPolicy, setRefundPolicy] = useState<string | null>(null);
  const [shippingPolicy, setShippingPolicy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/site-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.refundPolicy) setRefundPolicy(d.refundPolicy);
        if (d.shippingPolicy) setShippingPolicy(d.shippingPolicy);
      })
      .catch(() => {});
  }, []);

  // PC 사이드바에서 탭 전환 이벤트 수신
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as "review" | "info";
      setActiveTab(tab);
      setTimeout(() => {
        document.getElementById("product-tabs")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    };
    window.addEventListener("switch-product-tab", handler);
    return () => window.removeEventListener("switch-product-tab", handler);
  }, []);

  const tabs = [
    { key: "detail" as const, label: "상세정보" },
    { key: "review" as const, label: `리뷰 (${reviewCount})` },
    { key: "info" as const, label: "배송/교환" },
  ];

  return (
    <div id="product-tabs">
      <div className={`sticky z-30 bg-white border-b border-gray-200 ${embedded ? "top-0" : "top-14"}`}>
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-[13px] font-medium transition-colors relative ${
                activeTab === tab.key ? "text-black" : "text-gray-400"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">
        {activeTab === "detail" && (
          <div className="animate-fade-in">
            <div className="px-4 pt-5 pb-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Icon name="File" size={14} strokeWidth={1.5} className="text-amber-500" />
                  상품 상세정보
                </h3>
                {description
                  ? renderDescription(description)
                  : <p className="text-sm text-gray-400">상세정보가 없습니다.</p>
                }
              </div>
            </div>
            {detailContent && (
              <div className="px-4 pb-2">
                <div
                  className="product-detail-content prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: detailContent }}
                />
              </div>
            )}
            {/* 표준 교환·환불 규정 (하드코딩 · 바닐라 플라워/플라워 테마) — SHOW_STANDARD_REFUND_CARD 로 임시 비노출 */}
            {SHOW_STANDARD_REFUND_CARD && (
              <div className="px-4 pt-3 pb-6">
                <StandardRefundCard />
              </div>
            )}
          </div>
        )}

        {activeTab === "review" && (
          <div className="animate-fade-in px-4 py-5">
            {reviewCount > 0 ? (
              <div dangerouslySetInnerHTML={{ __html: reviewsHtml }} />
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">아직 리뷰가 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">첫 번째 리뷰를 작성해 주세요!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "info" && (
          <div className="animate-fade-in px-4 py-5">
            <div className="space-y-5">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900 mb-2">배송 안내</h3>
                {shippingPolicy ? (
                  <div className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-line">{shippingPolicy}</div>
                ) : (
                  <div className="space-y-1.5 text-[12px] text-gray-600 leading-relaxed">
                    <p>결제 완료 후 3~5일 이내 출고</p>
                    <p>도서산간 지역은 추가 1~2일 소요될 수 있습니다.</p>
                  </div>
                )}
              </div>
              <div className="h-px bg-gray-100" />
              <div>
                <h3 className="text-[13px] font-bold text-gray-900 mb-2">교환\u00B7환불 안내</h3>
                {refundPolicy ? (
                  <RefundPolicyBlock text={refundPolicy} />
                ) : (
                  <div className="space-y-1.5 text-[12px] text-gray-600 leading-relaxed">
                    <p>교환/반품 기간: 수령 후 7일 이내</p>
                    <p>교환/반품 배송비: 무료 (단순 변심 시 왕복 배송비 부담)</p>
                    <p>상품 수령 후 사용하지 않은 경우에 한해 가능합니다.</p>
                    <p>택이 제거되었거나 세탁된 제품은 교환/반품이 불가합니다.</p>
                    <p>환불은 반품 상품 수거 확인 후 1~3영업일 이내 처리됩니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
