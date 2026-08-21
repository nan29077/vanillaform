"use client";

import { Icon } from '@/components/shared/Icon';
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {Radio, Package, ShieldCheck, Megaphone, Wallet, X} from 'lucide-react';

interface NotiItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: any; color: string; bg: string }> = {
  live_start: { icon: Radio, color: "text-rose-500", bg: "bg-rose-50" },
  order: { icon: Package, color: "text-blue-500", bg: "bg-blue-50" },
  channel: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
  payout_rejected: { icon: Wallet, color: "text-red-500", bg: "bg-red-50" },
  system: { icon: Megaphone, color: "text-gray-500", bg: "bg-gray-100" },
};

// 미읽음 수 조회 — 진행 중인 요청을 공유한다.
// 같은 화면에 벨이 2개(대시보드 사이드바 + 모바일 사이드바) 렌더되므로 그냥 두면
// 동일한 요청이 인스턴스 수만큼 동시에 나간다.
let inflightCount: Promise<number> | null = null;
function fetchUnreadCount(): Promise<number> {
  if (!inflightCount) {
    inflightCount = fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => Number(d?.unreadCount) || 0)
      .catch(() => 0)
      .finally(() => {
        inflightCount = null;
      });
  }
  return inflightCount;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// 우측 상단 알림 버튼 + 카드형 화이트 드롭다운 팝업.
// allHref: "전체 보기" 링크 경로. /my/* 는 구매자 전용이라 대시보드(셀러/브랜드 등)에서는
// 클릭 시 역할 대시보드로 리다이렉트되므로, 그 경우 null을 넘겨 링크를 숨긴다.
export default function NotificationBell({ className = "", size = 20, buttonClassName = "", allHref = "/my/notifications" }: { className?: string; size?: number; buttonClassName?: string; allHref?: string | null }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 의존성은 반드시 원시값(userId)으로 둔다. session.user 객체를 그대로 쓰면
  // 세션이 확정될 때마다 참조가 바뀌어 loadCount 가 새로 만들어지고 아래 effect 가
  // 다시 돌아 같은 요청이 한 번 더 나간다.
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const loadCount = useCallback(() => {
    if (!userId) { setUnread(0); return; }
    fetchUnreadCount().then(setUnread);
  }, [userId]);

  // 경로 변경/로그인 변화 시 미읽음 수 갱신, 창 포커스 시 갱신
  useEffect(() => { loadCount(); setOpen(false); }, [loadCount, pathname]);
  useEffect(() => {
    const onFocus = () => loadCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadCount]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openPanel = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const d = await res.json();
      setItems(d?.items || []);
      setUnread(Number(d?.unreadCount) || 0);
      // 열람 시 전체 읽음 처리 → 뱃지 제거
      if ((Number(d?.unreadCount) || 0) > 0) {
        fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
        setUnread(0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 개별 알림 삭제 → 목록에서 제거 + 미읽음 수 보정
  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target && !target.isRead) setUnread((u) => Math.max(0, u - 1));
      return prev.filter((it) => it.id !== id);
    });
    fetch(`/api/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!session?.user) {
      // 로그인 후 현재 페이지로 복귀 (셀러샵에 머무르도록)
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (open) setOpen(false);
    else openPanel();
  }, [session?.user, open, openPanel, router, pathname]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={handleClick}
        aria-label="알림"
        className={`relative hover:opacity-60 transition-opacity ${buttonClassName || "p-2"} ${className || "text-gray-900"}`}
      >
        <Icon name="Notification" size={size} strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* 화면 어디든 클릭 시 닫히도록 (모바일 터치 대응) */}
          <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[300px] max-w-[88vw] rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] border border-gray-100 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-[14px] font-extrabold text-gray-900">알림</p>
              {allHref && (
                <Link
                  href={allHref}
                  onClick={() => setOpen(false)}
                  className="text-[11px] text-gray-400 hover:text-gray-600"
                >
                  전체 보기
                </Link>
              )}
            </div>

            {/* 목록 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="py-10 text-center text-[12px] text-gray-400">불러오는 중…</div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Icon name="Notification" size={30} strokeWidth={1.5} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[12px]">받은 알림이 없어요</p>
                </div>
              ) : (
                <ul className="p-2 space-y-1.5">
                  {items.slice(0, 12).map((n) => {
                    const meta = TYPE_META[n.type] || TYPE_META.system;
                    const Icon = meta.icon;
                    const inner = (
                      <div className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-colors ${n.isRead ? "bg-white hover:bg-gray-50" : "bg-brand-50/50 hover:bg-brand-50"}`}>
                        <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={15} strokeWidth={1.8} className={meta.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-gray-900 truncate">{n.title}</p>
                          <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, n.id)}
                          aria-label="알림 삭제"
                          className="flex-shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <X size={14} strokeWidth={1.8} />
                        </button>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.linkUrl ? (
                          <Link href={n.linkUrl} onClick={() => setOpen(false)} className="block">
                            {inner}
                          </Link>
                        ) : inner}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
