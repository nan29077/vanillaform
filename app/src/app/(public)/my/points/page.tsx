import { Icon } from '@/components/shared/Icon';
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireBuyerSession } from "@/lib/buyerGuard";
import { Gift, TrendingUp, Clock} from 'lucide-react';

export const dynamic = "force-dynamic";

export default async function PointsPage() {
  const session = await requireBuyerSession();

  // Points feature - placeholder data for now
  const pointBalance = 0;
  const pointHistory: { id: string; type: string; amount: number; desc: string; date: string }[] = [];

  return (
    <div className="animate-fade-in pb-4">
      <div className="sticky top-12 z-30 bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-gray-500 hover:text-gray-900">
            <Icon name="ArrowRight" size={20} strokeWidth={1.5} className="rotate-180" />
          </Link>
          <h1 className="text-base font-bold text-gray-900">포인트</h1>
        </div>
      </div>

      {/* 포인트 잔액 */}
      <div className="mx-4 mt-4 bg-gradient-to-r from-brand-500 to-brand-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="Wallet" size={18} strokeWidth={1.5} />
          <span className="text-xs font-medium text-white/80">보유 포인트</span>
        </div>
        <p className="text-3xl font-bold">{pointBalance.toLocaleString()} P</p>
      </div>

      {/* 포인트 적립 방법 안내 */}
      <div className="px-4 mt-4">
        <h3 className="text-xs font-bold text-gray-500 mb-3">포인트 적립 방법</h3>
        <div className="space-y-2">
          {[
            { icon: Gift, label: "회원가입 보너스", desc: "신규 가입 시 1,000P 지급" },
            { icon: TrendingUp, label: "구매 적립", desc: "구매 금액의 1% 적립" },
            { icon: Clock, label: "리뷰 작성", desc: "리뷰 작성 시 200P 적립" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                <item.icon size={18} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-[11px] text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 포인트 내역 */}
      <div className="px-4 mt-6">
        <h3 className="text-xs font-bold text-gray-500 mb-3">포인트 내역</h3>
        {pointHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Icon name="Wallet" size={36} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">아직 포인트 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {pointHistory.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-800">{item.desc}</p>
                  <p className="text-[10px] text-gray-400">{item.date}</p>
                </div>
                <span className={`text-sm font-bold ${item.amount > 0 ? "text-brand-600" : "text-gray-500"}`}>
                  {item.amount > 0 ? "+" : ""}{item.amount.toLocaleString()}P
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
