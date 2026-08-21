import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { prisma } from "@/lib/prisma";
import { Radio, Package, ShieldCheck, Megaphone, Wallet} from 'lucide-react';
import NotificationsMarkRead from "@/components/shared/NotificationsMarkRead";

export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  live_start: { icon: Radio, color: "text-rose-500", bg: "bg-rose-50" },
  order: { icon: Package, color: "text-blue-500", bg: "bg-blue-50" },
  channel: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
  payout_rejected: { icon: Wallet, color: "text-red-500", bg: "bg-red-50" },
  system: { icon: Megaphone, color: "text-gray-500", bg: "bg-gray-100" },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return date.toLocaleDateString("ko-KR");
}

export default async function NotificationsPage() {
  const session = await requireBuyerSession();

  const items = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="animate-fade-in pb-6">
      {/* 진입 시 전체 읽음 처리 */}
      <NotificationsMarkRead />

      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-gray-500 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <h1 className="text-base font-bold text-gray-900">알림</h1>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Icon name="Notification" size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 받은 알림이 없어요</p>
          <p className="text-[11px] mt-1 text-gray-400">
            PICK한 라이브 셀러의 라이브와 주문 소식을 여기서 받아볼 수 있어요.
          </p>
        </div>
      ) : (
        <ul className="px-4 pt-3 space-y-2">
          {items.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            const Icon = meta.icon;
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                  n.isRead ? "border-gray-100 bg-white" : "border-brand-100 bg-brand-50/40"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={17} strokeWidth={1.7} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />}
                    <p className="text-[13px] font-bold text-gray-900 truncate">{n.title}</p>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.linkUrl ? (
                  <Link href={n.linkUrl} className="block active:scale-[0.99] transition-transform">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
