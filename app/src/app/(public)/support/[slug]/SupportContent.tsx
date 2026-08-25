"use client";
import { sanitizeHtml } from "@/lib/sanitize";

import { Icon } from '@/components/shared/Icon';
import { useRouter } from "next/navigation";
import { Hexagon} from 'lucide-react';
import { useState } from "react";

const FAQ_ITEMS = [
  { q: "배송은 얼마나 걸리나요?", a: "결제 완료 후 영업일 기준 2~5일 이내에 도착합니다. 주문 후 상품이 준비되면 순차적으로 발송되며, 발송 시점에 운송장 번호가 등록되어 마이페이지 > 주문내역에서 배송 조회가 가능합니다. 제주 및 도서산간 지역은 배송사 사정에 따라 1~3일가량 추가로 소요될 수 있으니 참고해 주세요." },
  { q: "교환/반품은 어떻게 하나요?", a: "상품 수령 후 7일 이내에 마이페이지 > 주문내역에서 해당 주문을 선택하거나 1대1 문의를 통해 신청해 주세요. 단순 변심의 경우 왕복 배송비가 부과되며, 상품 하자·오배송의 경우 배송비 없이 무료로 처리됩니다. 상품을 사용·훼손했거나 세탁한 경우, 그리고 식품·위생용품 등 재판매가 어려운 상품은 교환·반품이 제한될 수 있으니 개봉 전에 먼저 문의해 주세요. 접수 후 회수와 처리까지는 보통 3~5 영업일이 소요됩니다." },
  { q: "라이브 셀러가 되려면 어떻게 하나요?", a: "회원가입 시 '라이브 셀러' 유형을 선택하거나, 일반 회원으로 가입한 뒤 마이페이지에서 라이브 셀러 신청을 하면 됩니다. 운영 중인 SNS 채널(인스타그램·유튜브·틱톡 등) 정보를 함께 제출해 주시면 심사에 도움이 됩니다. 관리자 검토 후 1~3 영업일 이내에 승인 결과가 안내되며, 승인되면 나만의 샵 개설과 라이브 방송 기능이 활성화됩니다." },
  { q: "결제 수단은 무엇이 있나요?", a: "신용카드, 체크카드, 계좌이체, 간편계좌이체, 네이버페이, 카카오페이 등을 지원합니다. 결제 단계에서 원하는 수단을 선택할 수 있으며, 간편계좌이체를 이용하면 계좌번호 입력 없이 빠르게 결제할 수 있습니다. 결제 과정에서 오류가 발생하면 잠시 후 다시 시도하거나 1대1 문의로 알려 주세요." },
  { q: "비밀번호를 잊어버렸어요.", a: "로그인 페이지의 '비밀번호 찾기'를 이용해 주세요. 가입 시 사용한 이메일로 재설정 링크가 발송되며, 링크는 발송 후 일정 시간 동안만 유효합니다. 메일이 보이지 않으면 스팸함을 확인하시고, 그래도 받지 못하셨다면 1대1 문의로 알려 주시면 도와드리겠습니다." },
  { q: "라이브 방송을 보려면 어떻게 하나요?", a: "라이브 셀러의 샵 페이지에서 LIVE 뱃지가 표시된 셀러를 클릭하면 진행 중인 실시간 방송을 바로 시청할 수 있습니다. 방송 중에는 채팅으로 셀러와 소통하거나 소개되는 상품을 그 자리에서 구매할 수 있습니다. 별도 앱 설치 없이 모바일 웹에서 시청 가능하며, 안정적인 시청을 위해 Wi-Fi 환경을 권장합니다." },
  { q: "구매 후 리뷰는 어디서 작성하나요?", a: "마이페이지 > 주문내역에서 구매 확정된 주문을 선택해 리뷰를 작성할 수 있습니다. 배송 완료 후 일정 기간이 지나면 자동으로 구매 확정 처리되며, 사진과 함께 리뷰를 남기면 다른 구매자에게 큰 도움이 됩니다. 작성한 리뷰는 마이페이지에서 언제든 수정하거나 삭제할 수 있습니다." },
];

function HoneycombBg() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="honeycomb" x="0" y="0" width="56" height="48" patternUnits="userSpaceOnUse">
          <polygon points="14,2 42,2 56,26 42,46 14,46 0,26" fill="none" stroke="#92400e" strokeWidth="1.2" />
          <polygon points="14,2 42,2 56,26 42,46 14,46 0,26" fill="none" stroke="#92400e" strokeWidth="1.2" transform="translate(28,24)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#honeycomb)" />
    </svg>
  );
}

function PageBanner({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 px-5 py-8 text-center">
      <HoneycombBg />
      <div className="relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/25 rounded-2xl mb-3 backdrop-blur-sm">
          <span className="text-white">{icon}</span>
        </div>
        <h2 className="text-lg font-extrabold text-white drop-shadow-sm">{title}</h2>
        <p className="text-amber-100 text-xs mt-1">{subtitle}</p>
      </div>
      <span className="absolute right-5 top-3 text-5xl opacity-30 select-none"></span>
      <span className="absolute left-5 bottom-3 text-2xl opacity-20 select-none">🍯</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-amber-100 p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-4 bg-amber-400 rounded-full" />
      {children}
    </h3>
  );
}

function FaqPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border border-amber-100 rounded-xl overflow-hidden bg-white shadow-sm">
          <button
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-amber-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-[13px] font-semibold text-gray-900 pr-4">{item.q}</span>
            {open === i
              ? <Icon name="ChevronDown" size={16} className="text-amber-500 flex-shrink-0 rotate-180" />
              : <Icon name="ChevronDown" size={16} className="text-amber-400 flex-shrink-0" />}
          </button>
          {open === i && (
            <div className="px-4 pb-4 pt-1 bg-amber-50 border-t border-amber-100">
              <p className="text-[13px] text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("문의가 접수되었습니다. 영업일 기준 1~2일 내에 답변드리겠습니다.");
    setForm({ name: "", email: "", message: "" });
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">이름</label>
        <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
          placeholder="이름을 입력하세요"
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-amber-50/50" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">이메일</label>
        <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
          placeholder="email@example.com"
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-amber-50/50" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-amber-700 mb-1.5">문의 내용</label>
        <textarea required value={form.message} onChange={e => setForm({...form, message: e.target.value})}
          placeholder="문의 내용을 입력하세요"
          rows={6}
          className="w-full border border-amber-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-amber-50/50 resize-none" />
      </div>
      <button type="submit"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-md shadow-amber-200">
        <Icon name="Message" size={15} strokeWidth={1.5} />
        문의 접수하기
      </button>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────
// 법적 고지 문서(이용약관 / 개인정보처리방침)
// ※ 아래 내용은 바닐라폼 서비스 구조(통신판매중개 + 공동구매 + 라이브 커머스)에 맞춰
//   작성한 표준 문안입니다. 실제 시행 전에는 반드시 법률 검토를 받으시고,
//   통신판매업 신고번호 · 사업장 주소 · 수탁사 상호 등 확정된 정보로 갱신하세요.
// 관리자 > 사이트 > 푸터 콘텐츠에서 DB 내용을 저장하면 이 기본 문안 대신 그 내용이 노출됩니다.
// ────────────────────────────────────────────────────────────────

const COMPANY = {
  name: "주식회사 피디에이치솔루션",
  service: "바닐라폼",
  ceo: "박동훈",
  bizNum: "796-88-03580",
  email: "pdhdev@naver.com",
  tel: "070-8065-5946",
  effectiveDate: "2026년 8월 25일",
};

type LegalSection = { heading: string; body: string };

function LegalDoc({ sections, notice }: { sections: LegalSection[]; notice: string }) {
  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <Card key={i}>
          <SectionHeading>{s.heading}</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
        </Card>
      ))}
      <p className="text-amber-500 text-xs text-center pt-1 pb-2">{notice}</p>
    </div>
  );
}

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "제1조 (목적)",
    body:
      "이 약관은 " + COMPANY.name + "(이하 \"회사\")이 운영하는 " + COMPANY.service +
      " 서비스(이하 \"서비스\")를 이용함에 있어 회사와 회원 간의 권리·의무 및 책임사항, 서비스 이용 조건과 절차를 규정함을 목적으로 합니다.",
  },
  {
    heading: "제2조 (정의)",
    body:
      "1. \"서비스\"란 회사가 온라인으로 제공하는 상품 중개 거래, 공동구매, 라이브 커머스 및 이에 부수하는 일체의 서비스를 말합니다.\n" +
      "2. \"회원\"이란 이 약관에 동의하고 회사와 이용계약을 체결한 자로, 역할에 따라 구매회원·판매회원(셀러)·브랜드회원으로 구분됩니다.\n" +
      "3. \"판매회원(셀러)\"이란 회사의 승인을 받아 자신의 샵에서 상품을 판매하거나 라이브 방송을 진행하는 회원을 말합니다.\n" +
      "4. \"브랜드회원\"이란 상품을 등록·공급하는 사업자 회원을 말합니다.\n" +
      "5. \"공동구매 캠페인\"이란 일정 기간 또는 수량을 조건으로 할인된 가격에 판매하는 거래 방식을 말합니다.\n" +
      "6. \"커미션\"이란 판매 실적에 따라 판매회원에게 지급되는 수수료를 말합니다.\n" +
      "7. 이 약관에서 정하지 아니한 용어는 관계 법령 및 서비스별 안내에서 정하는 바에 따릅니다.",
  },
  {
    heading: "제3조 (약관의 명시와 개정)",
    body:
      "1. 회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.\n" +
      "2. 회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」 등 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.\n" +
      "3. 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 적용일자 7일 전부터 공지합니다. 다만 회원에게 불리한 변경의 경우에는 30일 전부터 공지하고, 회원이 명확히 인지할 수 있는 방법으로 개별 통지합니다.\n" +
      "4. 회원이 개정약관의 적용일까지 거부 의사를 표시하지 않으면 개정약관에 동의한 것으로 봅니다. 동의하지 않는 회원은 이용계약을 해지할 수 있습니다.",
  },
  {
    heading: "제4조 (통신판매중개자의 지위)",
    body:
      "1. 회사는 통신판매중개자로서 판매회원 및 브랜드회원과 구매회원 간의 거래를 위한 시스템을 제공할 뿐, 원칙적으로 통신판매의 당사자가 아닙니다.\n" +
      "2. 상품 정보의 정확성, 품질, 배송, 교환·반품, 환불 등 거래에 관한 책임은 해당 상품의 판매자에게 있습니다.\n" +
      "3. 다만 회사가 직접 판매자로 표시된 거래, 회사의 고의 또는 과실로 회원에게 손해가 발생한 경우에는 회사가 그 책임을 부담합니다.\n" +
      "4. 회사는 각 상품 페이지 및 샵 하단에 판매자의 사업자 정보를 확인할 수 있도록 제공합니다.",
  },
  {
    heading: "제5조 (이용계약의 성립)",
    body:
      "1. 이용계약은 가입 신청자가 이 약관에 동의하고 회사가 정한 절차에 따라 가입을 신청한 후, 회사가 이를 승낙함으로써 성립합니다.\n" +
      "2. 회사는 다음 각 호에 해당하는 경우 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.\n" +
      "  - 타인의 명의를 도용하거나 허위 정보를 기재한 경우\n" +
      "  - 이전에 이용제한 조치를 받고 그 사유가 해소되지 않은 경우\n" +
      "  - 만 14세 미만인 경우(법정대리인의 동의가 없는 경우)\n" +
      "  - 서비스의 정상적인 운영을 방해할 우려가 있다고 판단되는 경우\n" +
      "3. 판매회원 및 브랜드회원의 자격은 회사가 정한 심사 절차를 거쳐 부여되며, 회사는 심사에 필요한 자료 제출을 요청할 수 있습니다.",
  },
  {
    heading: "제6조 (회원정보의 관리)",
    body:
      "1. 회원은 가입 시 기재한 정보에 변경이 있는 경우 즉시 이를 수정하여야 하며, 수정하지 않아 발생한 불이익에 대해 회사는 책임지지 않습니다.\n" +
      "2. 계정 및 비밀번호의 관리 책임은 회원에게 있으며, 회원은 이를 제3자에게 양도·대여할 수 없습니다.\n" +
      "3. 회원이 자신의 계정이 부정하게 사용되고 있음을 인지한 경우 즉시 회사에 통지하고 안내에 따라야 합니다.",
  },
  {
    heading: "제7조 (회원 탈퇴 및 이용제한)",
    body:
      "1. 회원은 언제든지 서비스 내 절차를 통해 탈퇴를 신청할 수 있으며, 회사는 관련 법령이 정한 경우를 제외하고 지체 없이 처리합니다.\n" +
      "2. 진행 중인 주문, 미정산 금액, 분쟁이 있는 경우 해당 절차가 완료된 후 탈퇴 처리가 이루어질 수 있습니다.\n" +
      "3. 회사는 회원이 다음에 해당하는 경우 사전 통지 후 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다. 다만 긴급한 경우 사후에 통지할 수 있습니다.\n" +
      "  - 이 약관 또는 관계 법령을 위반한 경우\n" +
      "  - 허위 거래, 부정 결제, 시세 조작 등 건전한 거래 질서를 해치는 행위를 한 경우\n" +
      "  - 타인의 지식재산권·명예·개인정보를 침해한 경우",
  },
  {
    heading: "제8조 (회원에 대한 통지)",
    body:
      "1. 회사가 회원에게 통지를 하는 경우 회원이 등록한 이메일, 알림 메시지 등으로 할 수 있습니다.\n" +
      "2. 불특정 다수 회원에 대한 통지는 서비스 내 공지사항 게시로 개별 통지를 갈음할 수 있습니다. 다만 회원 본인의 거래에 중대한 영향을 미치는 사항은 개별 통지합니다.",
  },
  {
    heading: "제9조 (서비스의 제공 및 변경)",
    body:
      "1. 서비스는 연중무휴 1일 24시간 제공을 원칙으로 합니다.\n" +
      "2. 회사는 서비스의 기획·운영상 필요에 따라 제공 중인 서비스의 전부 또는 일부를 변경할 수 있으며, 중요한 변경 사항은 사전에 공지합니다.\n" +
      "3. 무료로 제공되는 서비스의 일부 또는 전부는 회사의 정책에 따라 수정·중단될 수 있습니다.",
  },
  {
    heading: "제10조 (서비스의 중단)",
    body:
      "1. 회사는 설비의 보수·점검·교체, 통신두절, 천재지변 등 불가항력적 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있습니다.\n" +
      "2. 사전에 예측 가능한 중단은 그 사유와 기간을 공지하며, 예측할 수 없는 중단의 경우 사유 해소 후 지체 없이 공지합니다.\n" +
      "3. 회사의 고의 또는 중대한 과실 없이 발생한 서비스 중단으로 인한 손해에 대해서는 책임을 지지 않습니다.",
  },
  {
    heading: "제11조 (구매신청 및 계약의 성립)",
    body:
      "1. 구매회원은 서비스에서 정한 절차에 따라 상품을 선택하고 주문 정보를 입력한 후 구매를 신청합니다.\n" +
      "2. 매매계약은 회사 또는 판매자가 구매신청에 대한 수신확인 통지를 발송하고, 결제가 정상적으로 완료된 시점에 성립합니다.\n" +
      "3. 다음의 경우 회사 또는 판매자는 구매신청을 승낙하지 않거나 계약을 취소할 수 있습니다.\n" +
      "  - 신청 내용에 허위·기재 누락·오기가 있는 경우\n" +
      "  - 재고 부족, 가격 오기재 등 계약을 이행할 수 없는 사유가 있는 경우\n" +
      "  - 부정한 목적의 구매로 판단되는 경우",
  },
  {
    heading: "제12조 (결제방법)",
    body:
      "1. 상품 대금은 신용·체크카드, 계좌이체, 간편결제 등 서비스에서 제공하는 방법으로 결제할 수 있습니다.\n" +
      "2. 결제 과정에서 발생하는 정보는 결제대행(PG) 사업자를 통해 안전하게 처리되며, 회사는 카드번호 등 민감한 결제정보를 직접 보관하지 않습니다.\n" +
      "3. 회원이 입력한 결제 정보의 오류로 발생한 손해에 대해서는 회원이 책임을 부담합니다.",
  },
  {
    heading: "제13조 (공동구매 캠페인의 특칙)",
    body:
      "1. 공동구매 캠페인은 사전에 고지된 기간 및 최소 수량 등의 조건을 충족한 경우에 한하여 성립합니다.\n" +
      "2. 캠페인이 목표를 달성하지 못하고 종료된 경우 결제된 금액은 전액 환불되며, 환불에 따른 수수료는 구매회원에게 부담시키지 않습니다.\n" +
      "3. 캠페인 성립 이후의 배송 일정은 캠페인 종료일을 기준으로 산정되며, 상품 페이지에 고지된 일정에 따릅니다.\n" +
      "4. 캠페인 할인가는 참여 조건(추천코드, 채널 인증 등)에 따라 달라질 수 있으며, 적용 조건은 캠페인 페이지에 명시합니다.",
  },
  {
    heading: "제14조 (라이브 커머스 방송)",
    body:
      "1. 판매회원은 회사가 제공하는 라이브 방송 기능을 이용해 상품을 소개하고 판매할 수 있습니다.\n" +
      "2. 판매회원은 방송 중 허위·과장 광고, 타인의 권리를 침해하는 표현, 관계 법령에 위반되는 내용을 게시하여서는 안 됩니다.\n" +
      "3. 회사는 방송 내용이 관계 법령 또는 이 약관에 위반된다고 판단되는 경우 사전 통지 없이 방송을 중단하거나 다시보기를 비공개 처리할 수 있습니다.\n" +
      "4. 방송 중 표시된 가격·혜택·재고 정보는 방송 시점을 기준으로 하며, 실제 주문 시점의 상품 페이지 정보가 우선합니다.",
  },
  {
    heading: "제15조 (재화의 공급 및 배송)",
    body:
      "1. 판매자는 구매회원과 별도의 약정이 없는 한 결제일부터 영업일 기준 7일 이내에 상품을 발송하기 위한 조치를 취합니다.\n" +
      "2. 배송 지연이 예상되는 경우 판매자 또는 회사는 그 사유와 예상 일정을 회원에게 안내합니다.\n" +
      "3. 배송 지역, 배송비, 도서산간 추가비용 등은 상품 페이지 및 배송 안내에 따릅니다.",
  },
  {
    heading: "제16조 (청약철회)",
    body:
      "1. 구매회원은 상품을 수령한 날부터 7일 이내에 청약철회를 할 수 있습니다.\n" +
      "2. 다음의 경우에는 청약철회가 제한될 수 있습니다.\n" +
      "  - 회원의 책임 있는 사유로 재화가 멸실·훼손된 경우(내용 확인을 위한 포장 훼손은 제외)\n" +
      "  - 사용 또는 일부 소비로 재화의 가치가 현저히 감소한 경우\n" +
      "  - 시간이 지나 재판매가 곤란할 정도로 가치가 감소한 경우\n" +
      "  - 복제 가능한 재화의 포장을 훼손한 경우\n" +
      "  - 주문에 따라 개별적으로 생산되는 재화로서 사전에 별도 고지하고 동의를 받은 경우\n" +
      "3. 표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우에는 수령일부터 3개월 이내, 그 사실을 안 날부터 30일 이내에 청약철회를 할 수 있습니다.",
  },
  {
    heading: "제17조 (청약철회의 효과 및 환급)",
    body:
      "1. 반환된 재화를 수령한 날부터 3영업일 이내에 대금을 환급합니다. 지급수단에 따라 환급 처리 기간은 달라질 수 있습니다.\n" +
      "2. 단순 변심에 의한 청약철회의 경우 반환에 필요한 비용은 구매회원이 부담합니다.\n" +
      "3. 재화의 하자, 오배송 등 판매자의 귀책사유로 인한 청약철회의 경우 반환 비용은 판매자가 부담합니다.\n" +
      "4. 신용카드 등으로 결제한 경우에는 지체 없이 해당 결제수단 사업자에게 대금 청구 정지 또는 취소를 요청합니다.",
  },
  {
    heading: "제18조 (판매회원 및 브랜드회원의 의무)",
    body:
      "1. 판매자는 관계 법령이 요구하는 사업자 정보 및 상품 정보를 정확히 등록·표시하여야 합니다.\n" +
      "2. 판매자는 상품의 품질, 안전, 표시·광고, 인허가 등에 관한 법령을 준수할 책임을 부담합니다.\n" +
      "3. 판매자는 주문 확인, 배송, 교환·반품, 고객 응대를 성실히 수행하여야 하며, 회사가 정한 응대 기준을 준수합니다.\n" +
      "4. 판매자의 귀책사유로 구매회원 또는 회사에 손해가 발생한 경우 판매자가 이를 배상할 책임이 있습니다.",
  },
  {
    heading: "제19조 (커미션 및 정산)",
    body:
      "1. 판매회원의 커미션은 상품별·캠페인별로 설정된 요율에 따라 산정됩니다.\n" +
      "2. 정산은 구매 확정 또는 캠페인 종료 이후 회사가 정한 정산 주기에 따라 이루어지며, 정산 내역은 서비스 내에서 확인할 수 있습니다.\n" +
      "3. 청약철회·반품·취소가 발생한 거래의 커미션은 정산 대상에서 제외되며, 이미 지급된 경우 차기 정산금에서 공제될 수 있습니다.\n" +
      "4. 회사는 관계 법령에 따라 원천징수 등 필요한 조치를 할 수 있으며, 출금 수수료 등은 사전에 고지한 기준에 따릅니다.\n" +
      "5. 부정 거래가 의심되는 경우 회사는 확인이 완료될 때까지 해당 정산을 보류할 수 있습니다.",
  },
  {
    heading: "제20조 (금지행위)",
    body:
      "회원은 다음 각 호의 행위를 하여서는 안 됩니다.\n" +
      "  - 허위 정보의 등록, 타인의 정보 도용\n" +
      "  - 자전거래, 허위 주문, 리뷰 조작 등 거래 질서를 왜곡하는 행위\n" +
      "  - 회사 또는 제3자의 지식재산권을 침해하는 행위\n" +
      "  - 서비스의 안정적 운영을 방해하는 프로그램의 사용, 비정상적인 접근 시도\n" +
      "  - 관계 법령에서 금지하는 재화의 판매 또는 광고\n" +
      "  - 외설·폭력적 내용 등 공서양속에 반하는 정보를 게시하는 행위",
  },
  {
    heading: "제21조 (게시물의 관리 및 지식재산권)",
    body:
      "1. 회원이 서비스에 게시한 콘텐츠의 저작권은 해당 회원에게 귀속됩니다.\n" +
      "2. 회원은 회사가 서비스의 운영·홍보를 위해 게시물을 서비스 내 및 회사가 운영하는 채널에 노출·복제·편집할 수 있는 권리를 무상으로 허락합니다.\n" +
      "3. 회사가 작성한 저작물에 대한 권리는 회사에 귀속되며, 회원은 이를 회사의 사전 동의 없이 영리 목적으로 이용할 수 없습니다.\n" +
      "4. 권리 침해를 주장하는 자의 요청이 있는 경우 회사는 관련 법령에 따라 게시물을 임시조치할 수 있습니다.",
  },
  {
    heading: "제22조 (개인정보의 보호)",
    body:
      "1. 회사는 관계 법령에 따라 회원의 개인정보를 보호하기 위해 노력하며, 개인정보의 처리에 관한 사항은 개인정보처리방침에 따릅니다.\n" +
      "2. 회사는 거래의 이행을 위하여 필요한 최소한의 범위에서 판매자에게 구매자의 배송 정보 등을 제공할 수 있습니다.",
  },
  {
    heading: "제23조 (책임의 제한)",
    body:
      "1. 회사는 천재지변, 정전, 통신 장애 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이 면제됩니다.\n" +
      "2. 회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.\n" +
      "3. 회사는 회원 간 또는 회원과 제3자 간에 발생한 분쟁에 대하여 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다. 다만 통신판매중개자로서 관계 법령이 정한 책임은 부담합니다.\n" +
      "4. 회사는 회원이 게시한 정보의 신뢰도·정확성에 대해 보증하지 않습니다.",
  },
  {
    heading: "제24조 (분쟁의 해결)",
    body:
      "1. 회사는 회원이 제기하는 의견과 불만을 신속하게 처리하기 위해 고객센터를 운영합니다.\n" +
      "2. 회사와 회원 간 발생한 분쟁은 상호 협의하여 해결하는 것을 원칙으로 하며, 협의가 이루어지지 않을 경우 소비자분쟁조정기구의 조정을 신청할 수 있습니다.\n" +
      "3. 이 약관은 대한민국 법령에 따라 규율되며, 분쟁에 관한 소송은 「민사소송법」상의 관할 법원에 제기합니다.\n" +
      "4. 문의처 — 고객센터 " + COMPANY.tel + " / 이메일 " + COMPANY.email,
  },
  {
    heading: "부칙 (사업자 정보)",
    body:
      "법인명 " + COMPANY.name + "\n" +
      "사업자등록 " + COMPANY.bizNum + "\n" +
      "대표자 " + COMPANY.ceo + "\n" +
      "메일 " + COMPANY.email + "\n" +
      "고객센터 " + COMPANY.tel,
  },
];

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "1. 총칙",
    body:
      COMPANY.name + "(이하 \"회사\")은 「개인정보 보호법」 등 관계 법령을 준수하며, 이용자의 개인정보를 안전하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다. 회사는 이 방침을 서비스 초기 화면 하단에 상시 게시하여 언제든지 확인할 수 있도록 합니다.",
  },
  {
    heading: "2. 수집하는 개인정보의 항목",
    body:
      "가. 회원가입 시\n" +
      "  - 필수: 이름, 이메일(아이디), 비밀번호, 휴대전화번호\n" +
      "  - 선택: 프로필 이미지, 생년월일, 성별\n" +
      "나. 판매회원·브랜드회원 신청 시\n" +
      "  - 상호, 대표자명, 사업자등록번호, 통신판매업 신고번호, 사업장 주소, 정산 계좌 정보, 운영 SNS 채널 정보\n" +
      "다. 상품 주문·결제 시\n" +
      "  - 수령인 정보(이름, 연락처, 주소), 주문 내역, 결제 수단 정보(결제대행사를 통해 처리)\n" +
      "라. 서비스 이용 과정에서 자동으로 생성·수집되는 정보\n" +
      "  - 접속 IP, 쿠키, 접속 일시, 서비스 이용 기록, 기기 및 브라우저 정보",
  },
  {
    heading: "3. 개인정보의 수집 방법",
    body:
      "회사는 다음의 방법으로 개인정보를 수집합니다.\n" +
      "  - 홈페이지 회원가입, 셀러·브랜드 입점 신청, 주문 및 문의 과정에서 이용자가 직접 입력\n" +
      "  - 고객센터 상담 과정에서의 수집\n" +
      "  - 서비스 이용 과정에서 생성정보 수집 도구를 통한 자동 수집",
  },
  {
    heading: "4. 개인정보의 처리 목적",
    body:
      "  - 회원 가입 의사 확인, 본인 식별 및 인증, 회원자격 유지·관리\n" +
      "  - 상품 주문·결제, 배송, 청약철회 및 환불 처리\n" +
      "  - 공동구매 캠페인 참여 확인 및 추천·커미션 정산\n" +
      "  - 고객 문의 응대, 분쟁 조정 및 기록 보존\n" +
      "  - 부정 이용 방지, 비인가 사용 확인 등 서비스 안전성 확보\n" +
      "  - 이용자의 동의를 받은 경우에 한하여 신규 서비스 안내 및 마케팅·광고 활용",
  },
  {
    heading: "5. 개인정보의 보유 및 이용 기간",
    body:
      "회사는 개인정보 처리 목적이 달성되면 지체 없이 파기합니다. 다만 관계 법령에서 정한 기간 동안은 아래와 같이 보관합니다.\n" +
      "  - 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)\n" +
      "  - 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)\n" +
      "  - 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)\n" +
      "  - 표시·광고에 관한 기록: 6개월 (전자상거래법)\n" +
      "  - 세법에서 정한 거래에 관한 장부 및 증빙서류: 5년 (국세기본법)\n" +
      "  - 서비스 접속 기록: 3개월 (통신비밀보호법)\n" +
      "  - 부정 이용 기록: 부정 이용 방지를 위해 탈퇴 후 1년",
  },
  {
    heading: "6. 개인정보의 제3자 제공",
    body:
      "1. 회사는 이용자의 개인정보를 제4조에서 명시한 범위를 초과하여 이용하거나 제3자에게 제공하지 않습니다.\n" +
      "2. 다만 다음의 경우에는 예외로 합니다.\n" +
      "  - 이용자가 사전에 동의한 경우\n" +
      "  - 법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우\n" +
      "3. 상품 거래의 이행을 위하여 해당 상품의 판매자(판매회원·브랜드회원)에게 주문자 및 수령인 정보(이름, 연락처, 주소, 주문 내역)를 제공합니다. 제공받은 자는 배송 및 고객 응대 목적으로만 이용하며, 목적 달성 후 지체 없이 파기합니다.",
  },
  {
    heading: "7. 개인정보 처리업무의 위탁",
    body:
      "회사는 원활한 서비스 제공을 위하여 아래 업무를 외부에 위탁할 수 있으며, 위탁계약 시 개인정보가 안전하게 관리되도록 필요한 사항을 규정하고 관리·감독합니다.\n" +
      "  - 결제 처리 및 결제 도용 방지: 결제대행(PG) 사업자\n" +
      "  - 상품 배송: 택배 및 물류 사업자\n" +
      "  - 문자·알림 메시지 발송: 메시지 발송 대행사\n" +
      "  - 데이터 보관 및 시스템 운영: 클라우드 인프라 제공사\n" +
      "위탁 업무의 내용이나 수탁자가 변경될 경우 이 방침을 통해 지체 없이 공개합니다.",
  },
  {
    heading: "8. 개인정보의 파기 절차 및 방법",
    body:
      "1. 파기 절차 — 목적이 달성된 개인정보는 별도의 저장소로 옮겨진 후 내부 방침 및 관계 법령에 따라 일정 기간 보관된 뒤 파기됩니다. 이 기간 동안 다른 목적으로 이용하지 않습니다.\n" +
      "2. 파기 방법 — 전자적 파일 형태는 복구할 수 없는 기술적 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.",
  },
  {
    heading: "9. 정보주체의 권리와 행사 방법",
    body:
      "1. 이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.\n" +
      "2. 권리 행사는 서비스 내 회원정보 관리 화면에서 직접 하거나, 개인정보 보호책임자에게 이메일·전화로 요청할 수 있으며 회사는 지체 없이 조치합니다.\n" +
      "3. 만 14세 미만 아동의 경우 법정대리인이 아동의 개인정보에 대한 권리를 행사할 수 있습니다.\n" +
      "4. 다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 삭제 요구가 제한될 수 있습니다.",
  },
  {
    heading: "10. 쿠키의 설치·운영 및 거부",
    body:
      "1. 회사는 이용자에게 맞춤형 서비스를 제공하기 위해 쿠키를 사용합니다. 쿠키는 로그인 상태 유지, 이용 형태 분석 등에 활용됩니다.\n" +
      "2. 이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다. 다만 쿠키 저장을 거부할 경우 로그인이 필요한 일부 서비스 이용에 제한이 있을 수 있습니다.",
  },
  {
    heading: "11. 개인정보의 안전성 확보 조치",
    body:
      "  - 관리적 조치: 내부관리계획 수립·시행, 취급 담당자의 최소화 및 정기 교육\n" +
      "  - 기술적 조치: 개인정보처리시스템 접근권한 관리, 비밀번호 등 중요 정보의 암호화 저장, 접속기록 보관, 보안 프로그램 운영\n" +
      "  - 물리적 조치: 전산실 및 자료 보관 장소에 대한 접근 통제",
  },
  {
    heading: "12. 만 14세 미만 아동의 개인정보",
    body:
      "회사는 만 14세 미만 아동의 회원가입을 원칙적으로 제한합니다. 부득이하게 수집이 필요한 경우에는 법정대리인의 동의를 받으며, 동의 여부 확인을 위해 필요한 최소한의 정보를 요구할 수 있습니다.",
  },
  {
    heading: "13. 개인정보 보호책임자",
    body:
      "회사는 개인정보 처리에 관한 업무를 총괄하고 이용자의 불만을 처리하기 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.\n" +
      "  - 개인정보 보호책임자: " + COMPANY.ceo + " (대표)\n" +
      "  - 이메일: " + COMPANY.email + "\n" +
      "  - 고객센터: " + COMPANY.tel + "\n" +
      "이용자는 서비스 이용 중 발생한 모든 개인정보 관련 문의를 위 연락처로 신고할 수 있으며, 회사는 지체 없이 답변·처리합니다.",
  },
  {
    heading: "14. 권익침해 구제 방법",
    body:
      "개인정보 침해로 인한 상담 및 피해 구제가 필요한 경우 아래 기관에 문의하실 수 있습니다.\n" +
      "  - 개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)\n" +
      "  - 개인정보침해신고센터: 118 (privacy.kisa.or.kr)\n" +
      "  - 대검찰청 사이버수사과: 1301 (www.spo.go.kr)\n" +
      "  - 경찰청 사이버수사국: 182 (ecrm.police.go.kr)",
  },
  {
    heading: "15. 개인정보처리방침의 변경",
    body:
      "이 방침의 내용 추가, 삭제 및 수정이 있을 경우 시행 7일 전부터 서비스 공지사항을 통해 고지합니다. 다만 이용자 권리의 중요한 변경이 있을 경우에는 최소 30일 전에 고지합니다.",
  },
];


const PAGE_META: Record<string, { subtitle: string; icon: React.ReactNode }> = {
  contact:      { subtitle: "빠르게 답변드릴게요", icon: <Icon name="Message" size={24} strokeWidth={1.5} /> },
  faq:          { subtitle: "궁금한 점을 찾아보세요", icon: <Icon name="Help" size={24} strokeWidth={1.5} /> },
  shipping:     { subtitle: "배송 및 반품 안내", icon: <Icon name="Truck" size={24} strokeWidth={1.5} /> },
  terms:        { subtitle: "서비스 이용 약관", icon: <Icon name="File" size={24} strokeWidth={1.5} /> },
  privacy:      { subtitle: "개인정보 보호 정책", icon: <Icon name="Certified" size={24} strokeWidth={1.5} /> },
  "seller-guide": { subtitle: "라이브 셀러로 시작하는 방법", icon: <Icon name="Store" size={24} strokeWidth={1.5} /> },
};

const CONTENT: Record<string, { title: string; body: () => React.ReactNode }> = {
  contact: { title: "1대1 문의", body: () => <ContactPage /> },
  faq:     { title: "자주 묻는 질문", body: () => <FaqPage /> },
  shipping: {
    title: "배송 안내",
    body: () => (
      <div className="space-y-3">
        <Card>
          <SectionHeading>배송 기간</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">결제 완료 후 영업일 기준 2~5일 이내 배송됩니다. 도서산간 지역은 추가 1~3일이 소요될 수 있습니다.</p>
        </Card>
        <Card>
          <SectionHeading>배송비</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">3만원 이상 구매 시 무료배송입니다. 미만 시 배송비 3,000원이 부과됩니다.</p>
        </Card>
        <Card>
          <SectionHeading>공동구매 배송</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">공동구매 캠페인 종료 후 목표 달성 시 배송이 시작됩니다. 캠페인 실패 시 전액 환불됩니다.</p>
        </Card>
        <Card>
          <SectionHeading>교환/반품</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">수령 후 7일 이내 신청 가능합니다. 단순 변심의 경우 왕복 배송비가 발생합니다. 상품 하자의 경우 전액 무료로 처리됩니다.</p>
        </Card>
      </div>
    ),
  },
  terms: {
    title: "이용약관",
    body: () => (
      <LegalDoc
        sections={TERMS_SECTIONS}
        notice={"본 약관은 " + COMPANY.effectiveDate + "부터 시행됩니다."}
      />
    ),
  },
  privacy: {
    title: "개인정보처리방침",
    body: () => (
      <LegalDoc
        sections={PRIVACY_SECTIONS}
        notice={"본 방침은 " + COMPANY.effectiveDate + "부터 적용됩니다."}
      />
    ),
  },
  "seller-guide": {
    title: "라이브 셀러 신청 안내",
    body: () => (
      <div className="space-y-3">
        <Card>
          <SectionHeading>라이브 셀러란?</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">라이브 셀러는 브랜드 상품을 자신의 샵에 등록하고 팔로워(팬)에게 판매하는 인플루언서/크리에이터입니다. 별도 소싱 없이 브랜드 상품을 선택해 판매할 수 있습니다.</p>
        </Card>
        <Card>
          <SectionHeading>신청 자격</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">SNS 채널(인스타그램, 유튜브, 틱톡 등)을 운영하는 누구나 신청 가능합니다. 팔로워 수 제한은 없으나 채널 활동 이력이 있어야 합니다.</p>
        </Card>
        <Card>
          <SectionHeading>신청 방법</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">회원가입 시 '라이브 셀러'를 선택하거나, 일반 회원으로 가입 후 마이페이지에서 라이브 셀러 신청을 할 수 있습니다. 관리자 검토 후 1~3 영업일 내 결과가 안내됩니다.</p>
        </Card>
        <Card>
          <SectionHeading>커미션 수익</SectionHeading>
          <p className="text-[13px] text-gray-600 leading-relaxed">판매가 이루어질 때마다 설정된 커미션율에 따라 수익이 발생합니다. 캠페인 종료 후 구매 확정 시점에 정산됩니다.</p>
        </Card>
        <a href="/seller-apply"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors shadow-md shadow-amber-200 mt-2">
          <Icon name="Store" size={15} strokeWidth={1.5} />
          라이브 셀러 신청하기
        </a>
      </div>
    ),
  },
};

/** DB에 저장된 자유 형식(HTML/텍스트) 콘텐츠를 바닐라 플라워 테마 카드로 렌더링 */
function parseSections(raw: string): { heading: string; body: string }[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === "sections" && Array.isArray(parsed.sections)) {
      return parsed.sections;
    }
  } catch {
    /* JSON이 아니면 무시 */
  }
  return null;
}

function DbContentBody({ content }: { content: string }) {
  const sections = parseSections(content);
  if (sections) {
    return (
      <div className="space-y-3">
        {sections.map((s, i) => (
          <Card key={i}>
            <SectionHeading>{s.heading}</SectionHeading>
            <p className="text-[13px] text-gray-600 leading-relaxed whitespace-pre-line">{s.body}</p>
          </Card>
        ))}
      </div>
    );
  }
  // HTML/일반 텍스트 fallback — 바닐라 플라워 카드 안에 표시
  return (
    <Card>
      <div
        className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line prose-sm"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
      />
    </Card>
  );
}

export interface DbContent {
  slug: string;
  title: string;
  content: string;
}

export default function SupportContent({
  slug,
  dbContent,
}: {
  slug: string;
  dbContent?: DbContent | null;
}) {
  const router = useRouter();
  const hardcoded = CONTENT[slug];
  const meta = PAGE_META[slug];

  // DB에 저장된 콘텐츠가 있으면 우선 사용 (관리자 편집/추가 내용 반영)
  const hasDb = !!(dbContent && dbContent.content && dbContent.content.trim().length > 0);

  if (!hardcoded && !hasDb) {
    return (
      <div className="max-w-[480px] mx-auto min-h-screen bg-amber-50 flex flex-col items-center justify-center px-4">
        <Hexagon size={48} strokeWidth={1} className="fill-amber-100 text-amber-400 mb-4" />
        <p className="text-amber-700 text-sm font-medium">페이지를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const title = dbContent?.title || hardcoded?.title || "고객센터";
  const subtitle = meta?.subtitle ?? "바닐라폼 고객센터";
  const icon = meta?.icon ?? <Icon name="File" size={24} strokeWidth={1.5} />;

  return (
    <div className="max-w-[480px] mx-auto min-h-screen bg-amber-50 pb-20">
      {/* 상단 네비게이션 바 */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b border-amber-100 px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="p-1.5 text-amber-600 hover:text-amber-800 transition-colors"
          aria-label="뒤로가기"
        >
          <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
        </button>
        <h1 className="text-[15px] font-bold text-gray-900">{title}</h1>
      </div>

      {/* 배너 */}
      <PageBanner title={title} subtitle={subtitle} icon={icon} />

      {/* 본문 */}
      <div className="px-4 pt-5">
        {hasDb ? (
          <DbContentBody content={dbContent!.content} />
        ) : slug === "faq" || slug === "contact" ? (
          <Card>{hardcoded.body()}</Card>
        ) : (
          hardcoded.body()
        )}
      </div>
    </div>
  );
}
