import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import Image from "next/image";
import { getFeatureFlags } from "@/lib/settings";
import {TrendingUp, Gift, Radio, Package, ShieldCheck, Users, ArrowRight} from 'lucide-react';

export const dynamic = "force-dynamic";

export const metadata = {
  title: "라이브 셀러로 신청하기 | 바닐라폼",
  description: "바닐라폼 라이브 셀러가 되어 내 팬과 함께 나만의 샵을 운영하세요.",
};

// 바닐라 플라워(플라워) 패턴 — 검정 히어로 위에 노랑 플라워을 은은하게 깔기 위한 인라인 SVG.
const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg width='28' height='49' viewBox='0 0 28 49' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f5a700' fill-opacity='0.18'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

const BOTTOM_BANNER = "/banners/banner4.jpg";

const BENEFITS = [
  { icon: Package, title: "소싱 걱정 없이", desc: "브랜드의 검증된 상품을 골라 내 샵에 담기만 하면 끝. 재고·배송은 브랜드가 책임져요." },
  { icon: TrendingUp, title: "판매 커미션", desc: "내 샵에서 판매가 일어날 때마다 커미션을 받아요. 팔수록 수익이 쌓여요." },
  { icon: Gift, title: "추천 수익", desc: "내 추천 코드로 가입·구매한 팬의 매출에서도 추천 커미션이 발생해요." },
  { icon: Radio, title: "라이브 커머스", desc: "실시간 라이브 방송으로 팬과 소통하며 바로 판매할 수 있어요." },
  { icon: Users, title: "단골 팬 관리", desc: "PICK한 팬이 단골이 되고, 라이브·새 소식 알림으로 다시 찾아와요." },
  { icon: ShieldCheck, title: "안심 정산", desc: "투명한 정산 체계로 커미션을 정해진 주기에 안전하게 지급받아요." },
];

const STEPS = [
  { title: "라이브 셀러 신청", desc: "아래 버튼으로 라이브 셀러 회원가입을 진행해요." },
  { title: "관리자 승인", desc: "보통 1~2 영업일 내 심사 후 승인돼요." },
  { title: "샵 개설 & 상품 선택", desc: "내 샵을 꾸미고 판매할 브랜드 상품을 골라요." },
  { title: "판매 & 정산", desc: "샵·라이브로 판매하고 커미션을 정산받아요." },
];

const FAQ = [
  { q: "라이브 셀러가 되려면 비용이 드나요?", a: "입점/가입 비용은 없습니다. 판매가 발생하면 약정된 커미션 구조로 정산됩니다." },
  { q: "상품은 직접 준비해야 하나요?", a: "아니요. 브랜드가 등록한 상품 중에서 골라 내 샵에 추가합니다. 재고·배송은 브랜드가 담당합니다." },
  { q: "승인까지 얼마나 걸리나요?", a: "일반적으로 1~2 영업일 이내에 관리자 검토 후 승인됩니다." },
  { q: "팔로워(팬)가 적어도 신청할 수 있나요?", a: "네, 누구나 신청할 수 있어요. 바닐라폼의 단골 PICK·라이브 기능으로 팬을 키워갈 수 있습니다." },
];

export default async function BecomeSellerPage() {
  const { beeDecoration: SHOW_BEES } = await getFeatureFlags();
  return (
    <div className="bg-white min-h-screen pb-40">
      {/* ───── 히어로 (검정 + 플라워 + 노랑) ───── */}
      <section className="relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0" style={{ backgroundImage: HONEYCOMB }} />
        <div className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative px-6 pt-12 pb-11 text-white">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 text-black px-3 py-1 mb-4">
            <Icon name="Store" size={12} strokeWidth={2.5} />
            <span className="text-[10px] font-extrabold tracking-wide">SELLER PROGRAM</span>
          </div>
          <div className="flex items-start gap-3">
            <h1 className="text-[28px] font-extrabold leading-tight">
              내 팬과 함께,
              <br />나만의 <span className="text-brand-500">샵</span>을 열다
            </h1>
            {SHOW_BEES && <Image src="/favicon.svg" alt="" width={54} height={54}
              className="w-12 h-12 object-contain mt-1 pointer-events-none select-none flex-shrink-0 opacity-80" unoptimized aria-hidden="true" />}
          </div>
          <p className="mt-3.5 text-[13px] text-gray-300 leading-relaxed">
            좋아하는 브랜드 상품을 큐레이션하고,
            <br />라이브와 단골 PICK으로 나만의 커머스를 시작하세요.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white px-3 py-1.5"><Icon name="Wallet" size={12} className="text-brand-500" /> 판매 커미션</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white px-3 py-1.5"><Icon name="Gift" size={12} className="text-brand-500" /> 추천 수익</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-white px-3 py-1.5"><Icon name="Live" size={12} className="text-brand-500" /> 라이브 판매</span>
          </div>
        </div>
      </section>

      {/* ───── 셀러 혜택 ───── */}
      <section className="px-5 pt-9">
        <div className="flex items-center gap-2">
          <h2 className="text-[19px] font-extrabold text-gray-900">라이브 셀러 혜택</h2>
          {SHOW_BEES && <Image src="/favicon.svg" alt="" width={42} height={42}
            className="w-9 h-9 object-contain pointer-events-none select-none opacity-75" unoptimized aria-hidden="true" />}
        </div>
        <p className="mt-1 text-[12px] text-gray-400">바닐라폼가 라이브 셀러에게 드리는 것들</p>
        <div className="mt-4 space-y-2">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="flex items-start gap-3 rounded-2xl border border-gray-100 p-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-900">{b.title}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───── 진행 절차 ───── */}
      <section className="px-5 pt-9">
        <h2 className="text-[19px] font-extrabold text-gray-900">신청 절차</h2>
        <div className="mt-4 space-y-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3 rounded-2xl border border-gray-100 px-4 py-3.5">
              <div className="w-7 h-7 rounded-full bg-brand-500 text-black text-[12px] font-extrabold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[13px] font-bold text-gray-900">{s.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── 지금 셀러가 되면 (체크리스트, 검정+노랑) ───── */}
      <section className="px-5 pt-9">
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 p-6 text-white">
          <div className="absolute inset-0" style={{ backgroundImage: HONEYCOMB }} />
          <div className="relative">
            <h3 className="text-[16px] font-extrabold flex items-center gap-1.5">
              <Icon name="Store" size={16} className="text-brand-500" /> 지금 라이브 셀러가 되면
            </h3>
            <ul className="mt-3.5 space-y-2.5">
              {["가입·입점 비용 0원", "브랜드 상품 자유 선택", "라이브·공동구매 판매 채널 제공", "투명한 커미션 정산"].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[13px] text-gray-100">
                  <span className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                    <Icon name="Check" size={13} strokeWidth={3} className="text-black" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───── 자주 묻는 질문 ───── */}
      <section className="px-5 pt-9">
        <h2 className="text-[19px] font-extrabold text-gray-900">자주 묻는 질문</h2>
        <div className="mt-4 space-y-2">
          {FAQ.map((f) => (
            <div key={f.q} className="rounded-2xl border border-gray-100 p-4">
              <p className="text-[13px] font-bold text-gray-900 flex items-start gap-1.5">
                <span className="text-brand-600">Q.</span> {f.q}
              </p>
              <p className="text-[12px] text-gray-500 mt-1.5 leading-relaxed pl-5">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───── 하단 배너 (banner4) + 카피 ───── */}
      <section className="px-4 pt-9">
        <div className="relative rounded-3xl overflow-hidden">
          <div
            className="aspect-[16/10] bg-cover bg-center"
            style={{ backgroundImage: `url(${BOTTOM_BANNER})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/35 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="text-[16px] font-extrabold leading-snug">상품이 아니라, 당신을 사는 팬</p>
            <p className="text-[12px] text-gray-200 mt-1 leading-relaxed">
              바닐라폼에서는 라이브 셀러의 취향과 신뢰가 곧 브랜드가 됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* ───── 하단 고정 CTA — 하단 탭바(약 3.5rem) 위에 항상 노출 ───── */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] z-[55] px-4 pt-3 pb-3 bg-gradient-to-t from-white via-white to-white/0"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <Link
           href="/auth/register?role=SELLER"
          className="block w-full py-3.5 bg-gray-900 text-white font-bold text-sm text-center rounded-xl hover:bg-gray-800 transition-colors"
        >
          라이브 셀러 신청하기
        </Link>
      </div>
    </div>
  );
}
