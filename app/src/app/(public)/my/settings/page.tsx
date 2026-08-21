import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { prisma } from "@/lib/prisma";
import { Lock, Globe} from 'lucide-react';
import BuyerNotificationSettings from "@/components/shared/BuyerNotificationSettings";
import BuyerProfileEditForm from "@/components/shared/BuyerProfileEditForm";
import AvatarPicker from "@/components/shared/AvatarPicker";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireBuyerSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user!.id },
    select: { name: true, email: true, phone: true, createdAt: true, avatar: true },
  });

  if (!user) redirect("/auth/login");

  // 구매회원 알림 수신 설정(종류별 ON/OFF)
  const buyer = await prisma.buyerProfile.findUnique({
    where: { userId: session.user!.id },
    select: { liveAlimtalkOptIn: true, notifyOrder: true },
  });

  const settingsItems = [
    { icon: Lock, label: "비밀번호 변경", desc: "비밀번호를 안전하게 변경" },
    { icon: Globe, label: "언어 설정", desc: "한국어" },
  ];

  return (
    <div className="animate-fade-in pb-4">
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-gray-500 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <h1 className="text-base font-bold text-gray-900">설정</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* 내 가입정보 (닉네임/연락처 수정 + 이메일/가입일 확인) */}
        <BuyerProfileEditForm
          initial={{
            name: user.name,
            email: user.email,
            phone: user.phone,
            joinedAt: new Date(user.createdAt).toISOString(),
          }}
        />

        {/* 아바타 피커 */}
        <AvatarPicker currentAvatar={user.avatar} />

        {/* 알림 수신 설정 (구매회원) — 종류별 ON/OFF */}
        {buyer && (
          <BuyerNotificationSettings
            initial={{ liveAlimtalkOptIn: buyer.liveAlimtalkOptIn, notifyOrder: buyer.notifyOrder }}
          />
        )}

        {/* 설정 메뉴 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-4">
          {settingsItems.map((item, idx) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 text-left ${
                idx < settingsItems.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              <item.icon size={18} strokeWidth={1.5} className="text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-800">{item.label}</p>
                <p className="text-[10px] text-gray-400">{item.desc}</p>
              </div>
              <Icon name="ChevronDown" size={16} strokeWidth={1.5} className="text-gray-300 -rotate-90" />
            </button>
          ))}
        </div>

        {/* 위험 영역 */}
        <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
          <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 text-left">
            <Icon name="Delete" size={18} strokeWidth={1.5} className="text-red-400" />
            <div className="flex-1">
              <p className="text-sm text-red-600">회원 탈퇴</p>
              <p className="text-[10px] text-red-300">계정과 모든 데이터가 삭제됩니다</p>
            </div>
            <Icon name="ChevronDown" size={16} strokeWidth={1.5} className="text-red-300 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
