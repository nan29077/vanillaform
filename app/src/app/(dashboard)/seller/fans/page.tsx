import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {Link2} from 'lucide-react';
import ChannelVerificationActions from "@/components/shared/ChannelVerificationActions";
import ScreenshotThumbnail from "@/components/shared/ScreenshotThumbnail";
import PaginatedFansList from "./PaginatedFansList";
import { getFeatureFlags } from "@/lib/settings";
import { pickBuyerAvatar } from "@/lib/defaults";

export const dynamic = "force-dynamic";

export default async function SellerFansPage() {
  const session = await auth();
  if (session?.user?.role !== "SELLER") redirect("/");

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session!.user!.id },
    include: {
      fans: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, gender: true, birthday: true, avatar: true, createdAt: true, accounts: { select: { provider: true } }, _count: { select: { orders: true } } } },
        },
      },
      referredBuyers: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, gender: true, birthday: true, avatar: true, createdAt: true, accounts: { select: { provider: true } }, _count: { select: { orders: true } } } },
        },
      },
      followers: {
        include: {
          buyer: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true, gender: true, birthday: true, avatar: true, createdAt: true, accounts: { select: { provider: true } }, _count: { select: { orders: true } } } },
            },
          },
        },
      },
      channelVerifications: {
        include: {
          buyer: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!seller) redirect("/");

  const flags = await getFeatureFlags();

  const pendingVerifications = seller.channelVerifications.filter((v) => v.status === "PENDING");
  const approvedVerifications = seller.channelVerifications.filter((v) => v.status === "APPROVED");
  const approvedBuyerIds = new Set(approvedVerifications.map((v) => v.buyerId));

  // ───── 모든 팬을 하나의 "픽 팬" 리스트로 통합 (팔로워 + 추천인유입 + 주력팬) ─────
  type FanRow = {
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    birthday: string | null;
    avatar: string | null;
    joinedAt: Date;
    orderCount: number;
    authProviders: string[]; // 소셜 가입 제공자(kakao·naver·google)
    isPick: boolean;       // 셀러를 PICK한 팔로워
    isVerified: boolean;   // 채널 인증 완료
    isReferred: boolean;   // 추천인 코드 유입
    isPrimary: boolean;    // 주력 팬(단골)
  };
  const fanMap = new Map<string, FanRow>();
  const ensure = (u: { id: string; name: string; email: string | null; phone: string | null; gender: string | null; birthday: string | null; avatar: string | null; createdAt: Date; accounts: { provider: string }[]; _count: { orders: number } }): FanRow => {
    let row = fanMap.get(u.id);
    if (!row) {
      row = {
        userId: u.id, name: u.name, email: u.email, phone: u.phone, gender: u.gender, birthday: u.birthday, avatar: u.avatar,
        joinedAt: u.createdAt, orderCount: u._count.orders,
        authProviders: [...new Set(u.accounts.map((a) => a.provider))],
        isPick: false, isVerified: false, isReferred: false, isPrimary: false,
      };
      fanMap.set(u.id, row);
    }
    return row;
  };

  for (const f of seller.followers) {
    const row = ensure(f.buyer.user);
    row.isPick = true;
    if (approvedBuyerIds.has(f.buyerId)) row.isVerified = true;
  }
  if (flags.referral) {
    for (const r of seller.referredBuyers) {
      ensure(r.user).isReferred = true;
    }
  }
  for (const fan of seller.fans) {
    ensure(fan.user).isPrimary = true;
  }

  // 정렬: 주력팬 → 채널인증 → 최근 가입순
  const allFans = Array.from(fanMap.values()).sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
    return b.joinedAt.getTime() - a.joinedAt.getTime();
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">팬 관리</h1>
        {/* totalFans 는 시드 더미값이 섞인 비정규화 컬럼이라 실제 목록과 어긋난다.
            아래 목록(allFans)과 같은 모집단을 그대로 쓴다. */}
        <p className="text-sm text-gray-500">총 {allFans.length}명의 팬</p>
      </div>

      {/* KPI */}
      <div className={`grid ${flags.referral ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"} gap-2 mb-6`}>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Users" size={18} strokeWidth={1.5} className="mx-auto text-pink-500 mb-1" />
          <p className="text-base font-bold text-gray-900">{allFans.length}</p>
          <p className="text-[9px] text-gray-400">전체 팬</p>
        </div>
        {flags.referral && (
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <Link2 size={18} strokeWidth={1.5} className="mx-auto text-brand-500 mb-1" />
            <p className="text-base font-bold text-gray-900">{seller.referredBuyers.length}</p>
            <p className="text-[9px] text-gray-400">추천인 유입</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Wishlist" size={18} strokeWidth={1.5} className="mx-auto text-red-500 mb-1" />
          {/* Pick 팬 = 셀러를 Pick(팔로우)한 구매자. 채널인증 여부와는 별개 지표다.
              (이전에는 채널인증된 팔로워를 세어 항상 "채널인증" KPI 와 같은 값이었다) */}
          <p className="text-base font-bold text-gray-900">{seller.followers.length}</p>
          <p className="text-[9px] text-gray-400">Pick 팬</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <Icon name="Check" size={18} strokeWidth={1.5} className="mx-auto text-emerald-500 mb-1" />
          <p className="text-base font-bold text-gray-900">{approvedVerifications.length}</p>
          <p className="text-[9px] text-gray-400">채널인증</p>
        </div>
      </div>

      {/* 채널 인증 대기 */}
      {pendingVerifications.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-orange-100 bg-orange-50">
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={14} className="text-orange-500" />
              <h3 className="text-sm font-bold text-gray-900">채널 인증 대기 ({pendingVerifications.length})</h3>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingVerifications.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={v.buyer.user.avatar || pickBuyerAvatar(v.buyer.user.id)} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{v.buyer.user.name}</p>
                  <p className="text-[10px] text-gray-400">{v.channelType} 구독 인증</p>
                </div>
                {v.screenshotUrl && (
                  <ScreenshotThumbnail src={v.screenshotUrl} />
                )}
                <ChannelVerificationActions verificationId={v.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───── 픽 팬 (통합 리스트) ───── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="Wishlist" size={14} className="text-pink-500 fill-pink-500" />
            <h3 className="text-sm font-bold text-gray-900">픽 팬 ({allFans.length})</h3>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">라이브 셀러를 PICK했거나 추천·단골로 연결된 모든 팬</p>
        </div>
        {allFans.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="Wishlist" size={32} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">아직 픽 팬이 없습니다</p>
            <p className="text-[10px] text-gray-300 mt-0.5">팬이 라이브 셀러를 PICK하면 여기에 모여요</p>
          </div>
        ) : (
          <PaginatedFansList
            items={allFans.map((fan) => ({
              ...fan,
              joinedAt: new Date(fan.joinedAt).toISOString(),
            }))}
          />
        )}
      </div>
    </div>
  );
}
