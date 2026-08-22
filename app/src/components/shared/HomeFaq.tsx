"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
;

const FAQS = [
  { q: "바닐라폼은 어떤 서비스인가요?", a: "브랜드의 좋은 상품을 신뢰하는 라이브 셀러(인플루언서)를 통해 만나는 단골 중심 커머스예요. 좋아하는 라이브 셀러를 PICK하고, 그 라이브 셀러만의 샵과 라이브를 즐길 수 있어요." },
  { q: "다른 라이브 셀러는 어떻게 찾나요?", a: "메인 상단의 검색창에서 라이브 셀러 이름이나 라이브 코드로 검색하면 돼요. 바닐라폼은 아무나 둘러보는 곳이 아니라, 내가 아는·좋아하는 라이브 셀러와 깊게 연결되는 단골형 서비스예요." },
  { q: "PICK은 무엇인가요?", a: "마음에 드는 라이브 셀러를 단골로 등록하는 기능이에요. PICK하면 그 라이브 셀러의 라이브 시작·새 소식 알림을 받고, 전용 샵에서 편하게 쇼핑할 수 있어요." },
  { q: "라이브 방송은 어떻게 보나요?", a: "PICK한 라이브 셀러가 방송을 시작하면 알림이 와요. 메인의 '라이브 찾기'에서 라이브 셀러 이름이나 라이브 코드로 검색해 입장할 수도 있어요." },
  { q: "라이브 셀러로 활동하려면 어떻게 하나요?", a: "메인의 '라이브 셀러로 신청하기' 버튼에서 신청할 수 있어요. 입점·가입 비용은 없고, 브랜드 상품을 골라 판매하면 커미션을 받는 구조예요." },
  { q: "결제·배송·환불은 안전한가요?", a: "바닐라폼은 통신판매중개자로서 안전한 거래 시스템을 제공해요. 주문·배송 현황은 마이페이지에서 확인할 수 있고, 알림으로도 안내해 드려요." },
];

export default function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-[13px] font-bold text-gray-900 flex items-start gap-1.5">
                <span className="text-brand-500">Q</span> {f.q}
              </span>
              <Icon name="ChevronDown" size={16} className={`text-gray-300 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-brand-500" : ""}`} />
            </button>
            {isOpen && (
              <p className="px-4 pb-4 -mt-1 text-[12px] text-gray-500 leading-relaxed pl-9 animate-fade-in">{f.a}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
