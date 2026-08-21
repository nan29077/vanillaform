"use client";

import { Icon } from '@/components/shared/Icon';
import { useState } from "react";
import {X, Loader2} from 'lucide-react';
import SignupBadges from "@/components/shared/SignupBadges";
import { pickBuyerAvatar } from "@/lib/defaults";

const formatPrice = (n: number) => n.toLocaleString("ko-KR") + "원";
const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("ko-KR") : "-");

interface Props {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  joinedAt?: string | null;
  avatar?: string | null;
  gender?: string | null;
  birthday?: string | null;
  authProviders?: string[];
}

// 팬(회원) 기본 정보 확인 패널: 이름·이메일·연락처·가입일 + 총 구매액/건수(주문 API 요약).
export default function FanMemberInfo({ userId, name, email, phone, joinedAt, avatar, gender, birthday, authProviders }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ orderCount: number; totalSpent: number } | null>(null);
  const [error, setError] = useState("");

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/fans/${userId}/orders`);
      const data = await res.json();
      if (!res.ok) setError(data.error || "정보를 불러오지 못했습니다.");
      else setSummary(data.summary || { orderCount: 0, totalSpent: 0 });
    } catch {
      setError("정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const emailDisplay = email && !email.endsWith("@no-email.local") ? email : "미등록";

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-2.5 py-1.5"
      >
        <Icon name="MyPage" size={12} />
        회원 정보 확인
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="h-1 bg-gradient-to-r from-brand-400 to-brand-500" />
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-[15px] font-bold text-gray-900">회원 정보</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pb-5">
              {/* 프로필 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatar || pickBuyerAvatar(userId, gender)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 truncate">{name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{emailDisplay}</p>
                  <div className="mt-1"><SignupBadges providers={authProviders} /></div>
                </div>
              </div>

              {/* 상세 */}
              <div className="space-y-2.5">
                <InfoRow icon={<Icon name="Mail" size={14} className="text-gray-400" />} label="이메일" value={emailDisplay} />
                <InfoRow icon={<Icon name="Phone" size={14} className="text-gray-400" />} label="연락처" value={phone || "미등록"} />
                <InfoRow icon={<Icon name="Users" size={14} className="text-gray-400" />} label="성별" value={gender === "male" ? "남성" : gender === "female" ? "여성" : "미입력"} />
                <InfoRow icon={<Icon name="Calendar" size={14} className="text-gray-400" />} label="생년월일" value={birthday || "미입력"} />
                <InfoRow icon={<Icon name="Calendar" size={14} className="text-gray-400" />} label="가입일" value={formatDate(joinedAt ?? null)} />
                <div className="pt-1 border-t border-gray-50" />
                <InfoRow
                  icon={<Icon name="Wallet" size={14} className="text-brand-500" />}
                  label="총 구매액"
                  value={loading ? "불러오는 중…" : error ? "-" : formatPrice(summary?.totalSpent ?? 0)}
                  emphasize
                />
                <InfoRow
                  icon={<Icon name="Cart" size={14} className="text-gray-400" />}
                  label="구매 건수"
                  value={loading ? "" : error ? "-" : `${summary?.orderCount ?? 0}건`}
                />
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-gray-400">
                  <Loader2 size={13} className="animate-spin" /> 구매 정보 불러오는 중
                </div>
              )}
              {error && <p className="text-[11px] text-red-500 mt-3">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InfoRow({ icon, label, value, emphasize }: { icon: React.ReactNode; label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[12px] text-gray-500">{icon}{label}</span>
      <span className={emphasize ? "text-[14px] font-bold text-gray-900" : "text-[13px] text-gray-800"}>{value}</span>
    </div>
  );
}
