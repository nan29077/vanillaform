import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Gift, TrendingUp, Radio, ShieldCheck, Check, Users} from 'lucide-react';
import SellerApplyForm from "@/components/shared/SellerApplyForm";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: Gift, color: "text-brand-600", bg: "bg-brand-50", title: "소싱 없이 바로 시작", desc: "브랜드 상품을 골라 담기만 하면 바로 판매할 수 있어요." },
  { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", title: "판매 커미션 수익", desc: "판매가 이루어질 때마다 설정된 커미션을 받아요." },
  { icon: Radio, color: "text-rose-500", bg: "bg-rose-50", title: "라이브 커머스", desc: "실시간 방송으로 팔로워와 소통하며 즉시 판매해요." },
  { icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-50", title: "안심 정산 시스템", desc: "복잡한 정산·배송은 플랫폼이 처리해요." },
];

export default async function SellerApplyPage() {
  const session = await auth();

  // 비로그인: 로그인 페이지로
  if (!session?.user?.id) {
    redirect("/auth/register?type=seller");
  }

  const role = session.user.role;

  // 이미 셀러/브랜드/관리자인 경우 대시보드로
  if (role === "SELLER") redirect("/seller");
  if (role === "BRAND_ADMIN") redirect("/brand");
  if (role === "SUPER_ADMIN") redirect("/admin");

  // 구매자: 기존 신청 여부 확인
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, sellerProfile: { select: { id: true, isApproved: true } } },
  });

  const sellerApplied = !!user?.sellerProfile;
  const sellerApproved = user?.sellerProfile?.isApproved ?? false;

  return (
    <div className="min-h-screen bg-white pb-12">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <Link href="/" className="p-1.5 text-gray-500 hover:text-gray-900 transition-colors">
          <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
        </Link>
        <h1 className="text-[15px] font-bold text-gray-900">라이브 셀러 입점신청</h1>
      </div>

      {/* 히어로 */}
      <div className="bg-gray-900 text-white px-5 py-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-4">
          <Icon name="Store" size={28} strokeWidth={1.5} className="text-black" />
        </div>
        <h2 className="text-[22px] font-extrabold leading-snug">
          나만의 샵을 열고<br />팬과 함께 판매하세요
        </h2>
        <p className="mt-2 text-[13px] text-gray-300 leading-relaxed">
          상품 소싱 걱정 없이, 브랜드 상품을 골라<br />라이브·콘텐츠로 판매하고 커미션을 받아요.
        </p>
      </div>

      {/* 혜택 */}
      <section className="px-4 py-6">
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">라이브 셀러가 되면 이런 게 가능해요</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="rounded-2xl border border-gray-100 bg-white p-4">
                <span className={`w-9 h-9 rounded-xl ${b.bg} flex items-center justify-center mb-2`}>
                  <Icon size={17} className={b.color} strokeWidth={1.7} />
                </span>
                <p className="text-[12.5px] font-bold text-gray-900">{b.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 신청 절차 */}
      <section className="px-4 pb-6">
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">입점 절차</h3>
        <div className="space-y-2">
          {[
            { no: 1, title: "입점 신청", desc: "아래 버튼을 눌러 신청서를 제출하세요." },
            { no: 2, title: "관리자 검토", desc: "최고관리자가 신청 내용을 검토해요. (보통 1~3 영업일)" },
            { no: 3, title: "승인 완료", desc: "승인 후 라이브 셀러 대시보드에서 바로 샵을 운영할 수 있어요." },
          ].map((s) => (
            <div key={s.no} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {s.no}
              </span>
              <div>
                <p className="text-[13px] font-bold text-gray-900">{s.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 신청 폼 / 상태 */}
      <div className="px-4">
        <SellerApplyForm
          initialApplied={sellerApplied}
          initialApproved={sellerApproved}
          isLoggedIn={!!session}
        />
      </div>
    </div>
  );
}
